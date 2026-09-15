"""Deal router."""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from typing import Optional
from decimal import Decimal
import json
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from core.ws_manager import manager
from core.dependencies import get_current_user, get_deal_service, redis_service, get_session, _decode_token, SessionLocal, get_user_by_api_key
from services.deal import DealService, apply_markup
from models import User, BalanceHistory, Deal, ApiKeyLog
from schemas import DealCreateRequest, DealResponse
from repositories.user import UserRepository
from repositories.deal import DealRepository
from datetime import datetime

router = APIRouter()

UPLOAD_DIR = Path("/app/uploads/receipts")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_RECEIPT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_RECEIPT_SIZE = 10 * 1024 * 1024  # 10 MB


_DEAL_ERRORS = {
    "not_found": (404, "Deal not found"),
    "already_accepted": (409, "The deal has already been taken or closed"),
    "not_allowed": (403, "This deal is not available to you"),
    "user_not_found": (403, "User not found"),
    "no_rate": (409, "Deal has no rate, so the USDT amount for the balance can't be computed"),
    "has_receipt": (409, "A receipt is already attached, so the deal can't be handed back"),
}


def _deal_error(e: ValueError) -> HTTPException:
    status_code, detail = _DEAL_ERRORS.get(str(e), (409, str(e)))
    return HTTPException(status_code=status_code, detail=detail)


async def _announce(deal: Deal) -> None:
    """Tells every merchant who can see this deal that it changed.

    Deals sit in a shared pool, so once one merchant takes, hands back or closes
    a deal, everyone else's list has to follow right away, not on a reload.
    """
    await manager.broadcast_to_matching(
        json.dumps({
            "event": "deal_updated",
            "deal_id": deal.id,
            "status": deal.status,
            "accepted_by": deal.accepted_by,
        }),
        deal.to_xml,
    )


@router.get("/deals", response_model=list[DealResponse])
async def list_deals(
    deal_id: Optional[int] = None,
    status: Optional[str] = None,
    to_xml: Optional[str] = None,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    deals = await service.list_deals(user, deal_id, status, to_xml)
    user_repo = UserRepository(session)
    # Pool deals nobody has taken yet are shown at this merchant's own rate: every
    # merchant has their own markup, and it is fixed only when a deal is taken.
    my_markups = (await user_repo.get_markups([user.id])).get(user.id, {})
    result = []
    for deal in deals:
        deal_dict = {
            **deal.__dict__,
            "accepted_by_username": None,
        }
        if deal.status == "pending" and deal.accepted_by is None:
            deal_dict["our_rate"] = apply_markup(deal.rate, my_markups.get(deal.to_xml, Decimal(0)))
        if deal.accepted_by:
            accepted_user = await user_repo.get_by_id(deal.accepted_by)
            if accepted_user:
                deal_dict["accepted_by_username"] = accepted_user.username
        result.append(DealResponse(**deal_dict))
    return result


@router.get("/deals/history", response_model=list[DealResponse])
async def deals_history(
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """What this merchant did with deals, newest first.

    Completed deals are the ones they took and finished — these match their
    balance. Refused deals are the ones they turned down; a refusal only hides a
    deal from them, so it is shown from their side and nothing another merchant
    did with the deal afterwards is exposed.
    """
    from sqlalchemy import select

    entries: dict[int, tuple[datetime, dict]] = {}

    result = await session.execute(
        select(Deal).where(Deal.accepted_by == user.id, Deal.status.in_(("accepted", "refused")))
    )
    for deal in result.scalars().all():
        finished = deal.updated_at or deal.accepted_at or deal.received_at or deal.created_at
        entries[deal.id] = (finished, dict(deal.__dict__))

    for deal, refused_at in await service.repository.refusals_by(user.id):
        entries[deal.id] = (refused_at, {
            **deal.__dict__,
            "status": "refused",
            "updated_at": refused_at,
            "accepted_by": None,
            "accepted_at": None,
            "our_rate": None,
            "credited_usdt": None,
            "receipt_url": None,
        })

    ordered = sorted(entries.values(), key=lambda entry: entry[0], reverse=True)
    return [DealResponse(**data) for _, data in ordered]


@router.post("/deal/")
async def create_deal(
    data: DealCreateRequest,
    service: DealService = Depends(get_deal_service),
    session: AsyncSession = Depends(get_session),
    caller: User = Depends(get_user_by_api_key),
):
    """Creates a payout request.

    Requires a valid X-API-Key. The key only authenticates the caller. The new
    deal goes into a shared pool: every merchant paying out in to_xml sees it,
    and whoever takes it first executes the payout.
    """
    import sys
    from repositories.user import UserRepository

    print(f"[deal/create] Incoming deal: uid={data.uid}, from_xml={data.from_xml}, to_xml={data.to_xml}, caller={caller.username}", file=sys.stdout, flush=True)

    # This is a payout cabinet: merchants are matched by the currency they pay
    # OUT in, which is to_xml — the one configured in the merchant's settings.
    # from_xml is only what the client paid with and routes nothing.
    payout_xml = data.to_xml

    user_repo = UserRepository(session)
    users = await user_repo.get_all()
    eligible = [
        u for u in users
        if not u.is_banned and payout_xml in {c.xml for c in u.currencies}
    ]
    print(f"[deal/create] Merchants paying out in {payout_xml}: {[u.username for u in eligible]}", file=sys.stdout, flush=True)

    if not eligible:
        print(f"[deal/create] ERROR: No user found for payout currency {payout_xml}", file=sys.stdout, flush=True)
        raise HTTPException(status_code=404, detail=f"No user found for payout currency {payout_xml}")

    # user_id is a required column. With the shared pool it only records the first
    # eligible merchant at creation time; the merchant who actually handles the
    # deal is accepted_by.
    data_dict = data.model_dump()
    data_dict['user_id'] = eligible[0].id
    deal_request = DealCreateRequest(**data_dict)

    deal = await service.create(deal_request)
    print(f"[deal/create] Deal created: id={deal.id}, rate={data.rate}, visible to {len(eligible)} merchant(s)", file=sys.stdout, flush=True)

    session.add(ApiKeyLog(
        username=caller.username,
        used_at=datetime.now(),
        purpose=f"create_deal #{deal.id} ({payout_xml})",
        key_type="merchant",
    ))
    await session.commit()

    deal_data = data.model_dump(mode="json")
    deal_data["id"] = deal.id
    deal_data["user_id"] = deal.user_id
    deal_data["received_at"] = deal.received_at.isoformat() + "Z" if deal.received_at else None
    deal_data["accepted_by"] = None
    deal_data["accepted_at"] = None
    deal_data["updated_at"] = None
    # Merchants never get the caller's rate, only the rate with their own markup.
    deal_data.pop("rate", None)

    markups = await user_repo.get_markups([u.id for u in eligible])

    def render(ws_session) -> str:
        percent = markups.get(ws_session.user_id, {}).get(payout_xml, Decimal(0))
        our_rate = apply_markup(data.rate, percent)
        payload = dict(deal_data, our_rate=float(our_rate) if our_rate is not None else None)
        return json.dumps({
            "event": "new_deal",
            "deal_id": deal.id,
            "payout_xml": payout_xml,
            "data": payload,
        })

    # Pushed to every merchant with this payout currency, each at their own rate.
    await manager.broadcast_to_matching_each(payout_xml, render)

    try:
        await redis_service.publish_deal(deal.id, deal_data, payout_xml)
    except Exception:
        pass

    return {"id": deal.id}


@router.post("/deal/{deal_id}/accept")
async def accept_deal(
    deal_id: int,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    try:
        deal = await service.accept(deal_id, user.id)
    except ValueError as e:
        raise _deal_error(e) from e
    await _announce(deal)
    return {"id": deal.id, "status": deal.status}


@router.post("/deal/{deal_id}/refuse")
async def refuse_deal(
    deal_id: int,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    """Hides the deal from this merchant only; nothing is sent to Bizon."""
    try:
        deal = await service.refuse(deal_id, user.id)
    except ValueError as e:
        raise _deal_error(e) from e
    # A handed-back deal reappears for the other merchants.
    await _announce(deal)
    return {"id": deal.id, "status": deal.status}


@router.post("/deal/{deal_id}/complete")
async def complete_deal(
    deal_id: int,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    try:
        deal = await service.complete(deal_id, user.id)
    except ValueError as e:
        raise _deal_error(e) from e
    await _announce(deal)
    return {"id": deal.id, "status": deal.status}


@router.patch("/deal/{deal_id}/status")
async def update_deal_status(
    deal_id: int,
    status: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from models import Deal
    from schemas import DealStatus

    # Merchants move deals only through accept / refuse / complete, which claim
    # the deal atomically, fix the markup and sync Bizon. This raw setter
    # bypasses all of that, so it is admin-only.
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    if status not in {s.value for s in DealStatus}:
        raise HTTPException(status_code=422, detail=f"Unknown status '{status}'")
    if status == DealStatus.ACCEPTED.value:
        # Completing credits the balance in USDT and syncs Bizon. That happens in
        # exactly one place, so this generic endpoint can't take a shortcut.
        raise HTTPException(
            status_code=400,
            detail="Use POST /deal/{deal_id}/complete to complete a deal",
        )

    stmt = select(Deal).where(Deal.id == deal_id)
    result = await session.execute(stmt)
    deal = result.scalar_one_or_none()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if deal.status in ("accepted", "refused"):
        raise HTTPException(
            status_code=409,
            detail="Cannot change status of completed or refused deal",
        )

    deal.status = status
    await session.commit()
    await session.refresh(deal)

    return {"id": deal.id, "status": deal.status}


@router.post("/deal/{deal_id}/receipt")
async def upload_receipt(
    deal_id: int,
    file: UploadFile = File(...),
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    deal = await service.repository.get_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    # Only the merchant who took the deal pays it out, so only they attach the
    # receipt. user_id is just the first eligible merchant in the shared pool.
    if deal.accepted_by != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_RECEIPT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_RECEIPT_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_RECEIPT_SIZE:
        raise HTTPException(status_code=413, detail="File is too large (max 10 MB)")
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    # Only one receipt per deal — drop the previously stored file, if any.
    previous = Path(deal.receipt_url).name if deal.receipt_url else None

    filename = f"{deal_id}_{int(datetime.utcnow().timestamp())}{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, 'wb') as f:
        f.write(content)

    deal.receipt_url = f"/api/v1/deal/{deal_id}/receipt/download/{filename}"
    await session.commit()
    await session.refresh(deal)

    if previous and previous != filename:
        try:
            (UPLOAD_DIR / previous).unlink(missing_ok=True)
        except OSError:
            pass

    print(f"[receipt] Uploaded for deal {deal_id}: {filename}", file=__import__('sys').stdout, flush=True)
    return {"receipt_url": deal.receipt_url}


@router.get("/deal/{deal_id}/receipt/download/{filename}")
async def download_receipt(
    deal_id: int,
    filename: str,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    from fastapi.responses import FileResponse

    # Reject anything that is not a bare file name (path traversal).
    if filename != Path(filename).name:
        raise HTTPException(status_code=400, detail="Invalid file name")

    deal = await service.repository.get_by_id(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    # The merchant who took the deal; for older deals that were never taken, the
    # merchant they were created for.
    holder = deal.accepted_by if deal.accepted_by is not None else deal.user_id
    if holder != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    # The file must be the one actually attached to this deal, so a valid
    # deal_id cannot be paired with someone else's file name.
    if not deal.receipt_url or Path(deal.receipt_url).name != filename:
        raise HTTPException(status_code=404, detail="File not found")

    filepath = (UPLOAD_DIR / filename).resolve()
    if not filepath.is_file() or UPLOAD_DIR.resolve() not in filepath.parents:
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(filepath, filename=filename, content_disposition_type="inline")


@router.websocket("/ws/deals")
async def deals_ws(websocket: WebSocket, token: str = Query()) -> None:
    try:
        user_id = _decode_token(token)
        session = SessionLocal()
        user = await UserRepository(session).get_with_currencies(user_id)
        if not user:
            await websocket.accept()
            await websocket.close(code=1008, reason="User not found")
            return
    except HTTPException:
        await websocket.accept()
        await websocket.close(code=1008, reason="Invalid token")
        return

    if user.is_banned:
        await websocket.accept()
        await websocket.close(code=1008, reason="User is banned")
        return

    xml_codes = {c.xml for c in user.currencies}
    await manager.connect(
        websocket, xml_codes, is_active=user.is_active, is_admin=user.is_admin, user_id=user.id
    )

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
                action = msg.get("action")
                if action in ("pause", "resume"):
                    manager.set_active(websocket, action == "resume")
                # The currency list is deliberately not settable from the client:
                # a socket could otherwise subscribe itself to other merchants'
                # deals. The server pushes it when an admin changes it.
            except (ValueError, KeyError):
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

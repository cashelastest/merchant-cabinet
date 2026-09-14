"""Deal router."""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from typing import Optional
import json
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from core.ws_manager import manager
from core.dependencies import get_current_user, get_deal_service, redis_service, get_session, _decode_token, SessionLocal, get_user_by_api_key
from services.deal import DealService
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
    result = []
    for deal in deals:
        deal_dict = {
            **deal.__dict__,
            "accepted_by_username": None,
        }
        if deal.accepted_by:
            accepted_user = await user_repo.get_by_id(deal.accepted_by)
            if accepted_user:
                deal_dict["accepted_by_username"] = accepted_user.username
        result.append(DealResponse(**deal_dict))
    return result


@router.post("/deal/")
async def create_deal(
    data: DealCreateRequest,
    service: DealService = Depends(get_deal_service),
    session: AsyncSession = Depends(get_session),
    caller: User = Depends(get_user_by_api_key),
):
    """Creates a payout request.

    Requires a valid X-API-Key. The key only authenticates the caller — which
    merchant executes the payout is still decided by to_xml, so the caller does
    not have to hold the key of the merchant that ends up with the request.
    """
    import sys
    from repositories.user import UserRepository

    print(f"[deal/create] Incoming deal: uid={data.uid}, from_xml={data.from_xml}, to_xml={data.to_xml}, caller={caller.username}", file=sys.stdout, flush=True)

    # This is a payout cabinet: a merchant is picked by the currency it pays
    # OUT in, which is to_xml — the one configured in the merchant's settings.
    # from_xml is only what the client paid with and routes nothing.
    payout_xml = data.to_xml

    user_repo = UserRepository(session)
    users = await user_repo.get_all()
    print(f"[deal/create] Total users in system: {len(users)}", file=sys.stdout, flush=True)

    deal_user = None
    for user in users:
        if user.is_banned:
            print(f"[deal/create] Skipping banned user {user.id} ({user.username})", file=sys.stdout, flush=True)
            continue
        user_currencies = {c.xml for c in user.currencies}
        print(f"[deal/create] User {user.id} ({user.username}) supports: {user_currencies}", file=sys.stdout, flush=True)
        if payout_xml in user_currencies:
            deal_user = user
            print(f"[deal/create] Matched user {user.id} for payout currency {payout_xml}", file=sys.stdout, flush=True)
            break

    if not deal_user:
        print(f"[deal/create] ERROR: No user found for payout currency {payout_xml}", file=sys.stdout, flush=True)
        raise HTTPException(status_code=404, detail=f"No user found for payout currency {payout_xml}")

    # Add user_id to deal data
    data_dict = data.model_dump()
    data_dict['user_id'] = deal_user.id
    deal_request = DealCreateRequest(**data_dict)

    # The matched merchant's markup for this payout currency goes on top of the
    # caller's rate. Both are snapshotted on the deal.
    from decimal import Decimal
    markup_percent = await user_repo.get_markup(deal_user.id, payout_xml)
    our_rate = (data.rate * (Decimal(100) + markup_percent) / Decimal(100)).quantize(Decimal("0.00000001"))

    print(f"[deal/create] Creating deal for user {deal_user.id}, uid={data.uid}, rate={data.rate}, markup={markup_percent}%, our_rate={our_rate}", file=sys.stdout, flush=True)
    deal = await service.create(deal_request, markup_percent=markup_percent, our_rate=our_rate)
    print(f"[deal/create] Deal created: id={deal.id}, user_id={deal_user.id}", file=sys.stdout, flush=True)

    session.add(ApiKeyLog(
        username=caller.username,
        used_at=datetime.now(),
        purpose=f"create_deal #{deal.id} ({payout_xml})",
        key_type="merchant",
    ))
    await session.commit()

    deal_data = data.model_dump(mode="json")
    deal_data["id"] = deal.id
    deal_data["user_id"] = deal_user.id
    deal_data["received_at"] = deal.received_at.isoformat() + "Z" if deal.received_at else None
    deal_data["accepted_by"] = None
    deal_data["accepted_at"] = None
    deal_data["updated_at"] = None
    # Merchants only ever see the rate with their markup applied.
    deal_data.pop("rate", None)
    deal_data["our_rate"] = float(our_rate)

    ws_message = json.dumps({
        "event": "new_deal",
        "deal_id": deal.id,
        "payout_xml": payout_xml,
        "data": deal_data,
    })

    # Must use the same currency the merchant was picked by, otherwise a deal
    # is stored against one merchant and pushed live to a different set of them.
    await manager.broadcast_to_matching(ws_message, payout_xml)

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
        raise HTTPException(status_code=404 if str(e) == "not_found" else 409)
    return {"id": deal.id, "status": deal.status}


@router.post("/deal/{deal_id}/refuse")
async def refuse_deal(
    deal_id: int,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    try:
        deal = await service.refuse(deal_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=404 if str(e) == "not_found" else 409)
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
        if str(e) == "not_found":
            raise HTTPException(status_code=404, detail="Deal not found")
        if str(e) == "no_rate":
            raise HTTPException(
                status_code=409,
                detail="Deal has no rate, so the USDT amount for the balance can't be computed",
            )
        raise HTTPException(status_code=409)
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

    if not user.is_admin and user.id not in (deal.user_id, deal.accepted_by):
        raise HTTPException(status_code=403, detail="Access denied")

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
    if deal.user_id != user.id:
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
    if deal.user_id != user.id and not user.is_admin:
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
                elif action == "update_currencies":
                    xml_codes = set(msg.get("currencies", []))
                    manager.update_xml_codes(websocket, xml_codes)
            except (ValueError, KeyError):
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

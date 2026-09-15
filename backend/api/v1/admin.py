"""Admin router — only accessible to admin users."""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
import os
import uuid

from core.dependencies import get_user_service, require_admin, get_session
from services.user import UserService
from schemas import CreateUserRequest
from models import User, Deal, ApiKeyLog, Payout, BalanceHistory


from decimal import Decimal
from pydantic import field_validator


class CurrenciesUpdate(BaseModel):
    currencies: list[str]


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_banned: Optional[bool] = None
    currencies: Optional[list[str]] = None


class MarkupsUpdate(BaseModel):
    # {"UAH": 2.5, "USDT": 0} — percent added on top of the API caller's rate
    markups: dict[str, Decimal]

    @field_validator("markups")
    @classmethod
    def markups_valid(cls, v: dict[str, Decimal]) -> dict[str, Decimal]:
        cleaned: dict[str, Decimal] = {}
        for xml, percent in v.items():
            code = xml.strip().upper()
            if not code:
                raise ValueError("Currency code must not be empty")
            # At -100% or below the resulting rate would be zero or negative.
            if not (Decimal("-100") < percent <= Decimal("1000")):
                raise ValueError(f"Markup for {code} must be above -100 and at most 1000")
            cleaned[code] = percent.quantize(Decimal("0.0001"))
        return cleaned


router = APIRouter(prefix="/admin")


@router.get("/users")
async def list_users(
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    users = await service.repository.get_all()
    markups = await service.repository.get_markups([u.id for u in users])
    return [
        {
            "id": u.id,
            "username": u.username,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "is_banned": u.is_banned,
            "currencies": [c.xml for c in u.currencies],
            "markups": {xml: float(p) for xml, p in markups.get(u.id, {}).items()},
        }
        for u in users
    ]


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    user = await service.repository.get_with_currencies(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "username": user.username,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "balance": user.balance,
        "currencies": [c.xml for c in user.currencies],
    }


@router.patch("/users/{user_id}/currencies")
async def set_user_currencies(
    user_id: int,
    data: CurrenciesUpdate,
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    user = await service.repository.get_with_currencies(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await service.update_currencies(user, data.currencies)
    return {
        "id": updated.id,
        "username": updated.username,
        "currencies": [c.xml for c in updated.currencies],
    }


@router.post("/users")
async def create_user(
    data: CreateUserRequest,
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    try:
        user = await service.create_user(data)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Username already taken")
    return {"id": user.id, "username": user.username}


@router.get("/logs")
async def get_logs(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(100, le=500),
):
    result = await session.execute(
        select(ApiKeyLog).order_by(ApiKeyLog.used_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "username": l.username,
            "used_at": l.used_at.isoformat(),
            "purpose": l.purpose,
            "key_type": l.key_type,
        }
        for l in logs
    ]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    data: UserUpdate,
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    import bcrypt
    user = await service.repository.get_with_currencies(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.username is not None:
        user.username = data.username
    if data.password is not None:
        hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        user.hashed_password = hashed
    if data.is_active is not None:
        user.is_active = data.is_active
    banned_now = False
    if data.is_banned is not None:
        if data.is_banned and user.is_admin:
            # An admin banning an admin could lock everyone out of the panel.
            raise HTTPException(status_code=400, detail="Admin accounts cannot be banned")
        banned_now = data.is_banned and not user.is_banned
        user.is_banned = data.is_banned
    if data.currencies is not None:
        await service.update_currencies(user, data.currencies)
    else:
        await service.repository.session.commit()
        await service.repository.session.refresh(user)
    if banned_now:
        # Drop live sockets so the merchant stops receiving deals right away,
        # not only after the next reconnect.
        from core.ws_manager import manager
        await manager.disconnect_user(user.id)
    return {
        "id": user.id,
        "username": user.username,
        "is_active": user.is_active,
        "is_banned": user.is_banned,
        "currencies": [c.xml for c in user.currencies],
    }


@router.put("/users/{user_id}/markups")
async def set_user_markups(
    user_id: int,
    data: MarkupsUpdate,
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    """Replaces the user's whole markup set; currencies left out get no markup."""
    user = await service.repository.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await service.repository.replace_markups(user_id, data.markups)
    await service.repository.session.commit()
    return {"id": user_id, "markups": {xml: float(p) for xml, p in data.markups.items()}}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await session.delete(user)
    await session.commit()
    return {"id": user_id, "deleted": True}


@router.get("/deals")
async def list_deals_admin(
    _: User = Depends(require_admin),
    user_id: Optional[int] = Query(None),
    username: Optional[str] = Query(None),
    today: bool = Query(False),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import func

    # Dates are taken from when the cabinet received a deal: created_at is set
    # by the API caller and can hold any date. Rows without received_at fall
    # back to created_at.
    deal_time = func.coalesce(Deal.received_at, Deal.created_at)
    query = select(Deal).order_by(deal_time.desc())

    if user_id:
        query = query.where(Deal.user_id == user_id)

    if username and username.strip():
        # Escape LIKE wildcards so "_" or "%" typed in the search match literally.
        pattern = (
            username.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        # The merchant of a deal is whoever took it: in the shared pool user_id is
        # only the first eligible merchant at creation time.
        query = query.join(User, User.id == Deal.accepted_by).where(
            User.username.ilike(f"%{pattern}%", escape="\\")
        )

    if today:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(deal_time >= today_start)
    else:
        if date_from:
            start_date = datetime.fromisoformat(date_from)
            query = query.where(deal_time >= start_date)
        if date_to:
            end_date = datetime.fromisoformat(date_to) + timedelta(days=1)
            query = query.where(deal_time < end_date)

    if status:
        query = query.where(Deal.status == status)

    result = await session.execute(query)
    deals = result.scalars().all()

    # One query for every username the page needs instead of one per row.
    user_ids = {d.user_id for d in deals} | {d.accepted_by for d in deals if d.accepted_by}
    usernames: dict[int, str] = {}
    if user_ids:
        rows = await session.execute(select(User.id, User.username).where(User.id.in_(user_ids)))
        usernames = dict(rows.all())

    def num(value):
        return float(value) if value is not None else None

    return [
        {
            "id": deal.id,
            "uid": deal.uid,
            "user_id": deal.user_id,
            "user_username": usernames.get(deal.user_id),
            "from_xml": deal.from_xml,
            "from_name": deal.from_name,
            # to_xml is the payout currency — the one merchants are matched by
            "to_xml": deal.to_xml,
            "to_name": deal.to_name,
            "to_values": deal.to_values,
            "receipt_url": deal.receipt_url,
            "status": deal.status,
            "rate": num(deal.rate),
            "markup_percent": num(deal.markup_percent),
            "our_rate": num(deal.our_rate),
            "turnover_usdt": num(deal.turnover_usdt),
            "credited_usdt": num(deal.credited_usdt),
            "margin_usdt": num(deal.margin_usdt),
            "accepted_by": deal.accepted_by,
            "accepted_by_username": usernames.get(deal.accepted_by) if deal.accepted_by else None,
            "accepted_at": deal.accepted_at.isoformat() if deal.accepted_at else None,
            "received_at": deal.received_at.isoformat() if deal.received_at else None,
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
        }
        for deal in deals
    ]


@router.post("/deals/{deal_id}/receipt")
async def upload_receipt(
    deal_id: int,
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    from models import Deal

    deal = await session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    os.makedirs("receipts", exist_ok=True)
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join("receipts", filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    url = f"/receipts/{filename}"
    deal.receipt_url = url
    await session.commit()

    return {"url": url}


@router.get("/deals/{deal_id}/receipt")
async def get_receipt(
    deal_id: int,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    from models import Deal

    deal = await session.get(Deal, deal_id)
    if not deal or not deal.receipt_url:
        raise HTTPException(status_code=404, detail="Receipt not found")

    return {"url": deal.receipt_url}


@router.get("/payouts")
async def list_payouts_admin(
    _: User = Depends(require_admin),
    user_id: Optional[int] = Query(None),
    today: bool = Query(False),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    query = select(Payout).order_by(Payout.created_at.desc())

    if user_id:
        query = query.where(Payout.user_id == user_id)

    if today:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(Payout.created_at >= today_start)
    else:
        if date_from:
            start_date = datetime.fromisoformat(date_from)
            query = query.where(Payout.created_at >= start_date)
        if date_to:
            end_date = datetime.fromisoformat(date_to) + timedelta(days=1)
            query = query.where(Payout.created_at < end_date)

    if status:
        query = query.where(Payout.status == status)

    result = await session.execute(query)
    payouts = result.scalars().all()

    from repositories.user import UserRepository
    user_repo = UserRepository(session)

    response = []
    for payout in payouts:
        payout_dict = {
            "id": payout.id,
            "user_id": payout.user_id,
            "amount": float(payout.amount),
            "currency": payout.currency,
            "card_holder": payout.card_holder,
            "card_number": payout.card_number,
            "phone_number": payout.phone_number,
            "bank_name": payout.bank_name,
            "receipt_url": payout.receipt_url,
            "status": payout.status,
            "created_at": payout.created_at.isoformat() if payout.created_at else None,
            "user_username": None,
        }
        if payout.user_id:
            user = await user_repo.get_with_currencies(payout.user_id)
            if user:
                payout_dict["user_username"] = user.username
        response.append(payout_dict)

    return response


@router.post("/users/{user_id}/reset-balance")
async def reset_user_balance(
    user_id: int,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_balance = user.balance
    user.balance = 0

    history = BalanceHistory(
        user_id=user_id,
        action="reset",
        amount=old_balance,
        reason=f"Reset by admin (was {old_balance})",
        created_at=datetime.now(),
    )
    session.add(history)
    await session.commit()

    return {"id": user_id, "old_balance": old_balance, "new_balance": 0}


@router.get("/users/{user_id}/balance-history")
async def get_balance_history(
    user_id: int,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(BalanceHistory).where(BalanceHistory.user_id == user_id).order_by(BalanceHistory.created_at.desc())
    )
    history = result.scalars().all()
    return [
        {
            "id": h.id,
            "action": h.action,
            "amount": h.amount,
            "reason": h.reason,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in history
    ]


@router.patch("/payouts/{payout_id}/status")
async def update_payout_status_admin(
    payout_id: int,
    status: str = Query(...),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    payout = await session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    if payout.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=409,
            detail="Cannot change status of completed or cancelled payout",
        )

    old_status = payout.status
    payout.status = status

    if status == "completed" and old_status != "completed":
        user = await session.get(User, payout.user_id)
        if user:
            user.balance += payout.amount
            history = BalanceHistory(
                user_id=user.id,
                action="payout_completed",
                amount=float(payout.amount),
                reason=f"Payout #{payout.id} completed ({payout.currency})",
                created_at=datetime.now(),
            )
            session.add(history)

    await session.commit()
    await session.refresh(payout)

    return {"id": payout.id, "status": payout.status}


@router.get("/deals/{user_id}")
async def list_user_deals(
    user_id: int,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    from models import DealRefusal

    def num(value):
        return float(value) if value is not None else None

    def as_row(deal, **override):
        row = {
            "id": deal.id,
            "uid": deal.uid,
            "user_id": deal.user_id,
            "from_xml": deal.from_xml,
            "to_xml": deal.to_xml,
            "to_values": deal.to_values,
            "status": deal.status,
            "accepted_by": deal.accepted_by,
            "receipt_url": deal.receipt_url,
            "rate": num(deal.rate),
            "markup_percent": num(deal.markup_percent),
            "our_rate": num(deal.our_rate),
            "turnover_usdt": num(deal.turnover_usdt),
            "credited_usdt": num(deal.credited_usdt),
            "margin_usdt": num(deal.margin_usdt),
            # The history page puts a deal on the day it was finished (updated_at),
            # falling back to arrival for deals that are still open.
            "updated_at": deal.updated_at.isoformat() if deal.updated_at else None,
            "received_at": deal.received_at.isoformat() if deal.received_at else None,
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
        }
        row.update(override)
        return row

    # A merchant's deals are the ones they took. In the shared pool user_id only
    # records the first eligible merchant at creation time.
    result = await session.execute(select(Deal).where(Deal.accepted_by == user_id))
    rows = {deal.id: as_row(deal) for deal in result.scalars().all()}

    # Plus the deals they refused. A refusal only hides a deal from this merchant,
    # so it is shown as refused from their side, without anything another
    # merchant did with the deal afterwards.
    refusals = await session.execute(
        select(Deal, DealRefusal.created_at)
        .join(DealRefusal, DealRefusal.deal_id == Deal.id)
        .where(DealRefusal.user_id == user_id)
    )
    for deal, refused_at in refusals.all():
        rows[deal.id] = as_row(
            deal,
            status="refused",
            accepted_by=None,
            receipt_url=None,
            markup_percent=None,
            our_rate=None,
            turnover_usdt=None,
            credited_usdt=None,
            margin_usdt=None,
            updated_at=refused_at.isoformat(),
        )

    return list(rows.values())


@router.post("/payouts/{payout_id}/receipt")
async def upload_payout_receipt_admin(
    payout_id: int,
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    payout = await session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    from pathlib import Path
    from datetime import datetime as _dt
    from api.v1.payout import ALLOWED_RECEIPT_EXTENSIONS, MAX_RECEIPT_SIZE

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_RECEIPT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_RECEIPT_EXTENSIONS))}",
        )

    contents = await file.read()
    if len(contents) > MAX_RECEIPT_SIZE:
        raise HTTPException(status_code=413, detail="File is too large (max 10 MB)")
    if not contents:
        raise HTTPException(status_code=400, detail="File is empty")

    upload_dir = Path("/app/uploads/receipts")
    upload_dir.mkdir(parents=True, exist_ok=True)

    previous = Path(payout.receipt_url).name if payout.receipt_url else None

    # Never build the on-disk name from the uploaded file name.
    filename = f"payout_{payout_id}_{int(_dt.now().timestamp())}{ext}"
    filepath = upload_dir / filename

    import aiofiles
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)

    url = f"/uploads/receipts/{filename}"
    payout.receipt_url = url
    await session.commit()

    if previous and previous != filename:
        try:
            (upload_dir / previous).unlink(missing_ok=True)
        except OSError:
            pass

    return {"url": url}

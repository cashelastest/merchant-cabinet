"""Admin router — only accessible to admin users."""

from datetime import date, datetime, timedelta
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
from models import User, Deal, ApiKeyLog


class CurrenciesUpdate(BaseModel):
    currencies: list[str]


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    currencies: Optional[list[str]] = None


router = APIRouter(prefix="/admin")


@router.get("/users")
async def list_users(
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    users = await service.repository.get_all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "currencies": [c.xml for c in u.currencies],
        }
        for u in users
    ]


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    _: User = Depends(require_admin),
    service: UserService = Depends(get_user_service),
):
    user = await service.repository.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "username": user.username,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "balance": 0,
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


@router.get("/deals")
async def list_deals(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    today: bool = Query(False),
    status: Optional[str] = Query(None),
):
    query = select(Deal).order_by(Deal.accepted_at.desc())

    if today:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(Deal.accepted_at >= start)
    else:
        if date_from:
            query = query.where(Deal.accepted_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.where(Deal.accepted_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time()))

    if status:
        query = query.where(Deal.status == status)
    else:
        query = query.where(Deal.status.in_(["accepted", "refused"]))

    result = await session.execute(query)
    deals = result.scalars().all()

    return [
        {
            "id": d.id,
            "uid": d.uid,
            "from_xml": d.from_xml,
            "from_name": d.from_name,
            "to_name": d.to_name,
            "to_values": d.to_values,
            "status": d.status,
            "accepted_by": d.accepted_by,
            "accepted_at": d.accepted_at.isoformat() if d.accepted_at else None,
            "received_at": d.received_at.isoformat() if d.received_at else None,
            "created_at": d.created_at.isoformat(),
        }
        for d in deals
    ]


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
    if data.currencies is not None:
        await service.update_currencies(user, data.currencies)
    else:
        await service.repository.session.commit()
        await service.repository.session.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "is_active": user.is_active,
        "currencies": [c.xml for c in user.currencies],
    }


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
    today: bool = Query(False),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    query = select(Deal).order_by(Deal.created_at.desc())

    if today:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(Deal.created_at >= today_start)
    else:
        if date_from:
            start_date = datetime.fromisoformat(date_from)
            query = query.where(Deal.created_at >= start_date)
        if date_to:
            end_date = datetime.fromisoformat(date_to) + timedelta(days=1)
            query = query.where(Deal.created_at < end_date)

    if status:
        query = query.where(Deal.status == status)

    result = await session.execute(query)
    deals = result.scalars().all()

    from repositories.user import UserRepository
    user_repo = UserRepository(session)

    response = []
    for deal in deals:
        deal_dict = {
            "id": deal.id,
            "uid": deal.uid,
            "from_xml": deal.from_xml,
            "from_name": deal.from_name,
            "to_name": deal.to_name,
            "to_values": deal.to_values,
            "status": deal.status,
            "accepted_by": deal.accepted_by,
            "accepted_by_username": None,
            "accepted_at": deal.accepted_at.isoformat() if deal.accepted_at else None,
            "received_at": deal.received_at.isoformat() if deal.received_at else None,
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
        }
        if deal.accepted_by:
            accepted_user = await user_repo.get_by_id(deal.accepted_by)
            if accepted_user:
                deal_dict["accepted_by_username"] = accepted_user.username
        response.append(deal_dict)

    return response


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

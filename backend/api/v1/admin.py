"""Admin router — only accessible to admin users."""

from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_user_service, require_admin, get_session
from services.user import UserService
from models import User, Deal


class CurrenciesUpdate(BaseModel):
    currencies: list[str]


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

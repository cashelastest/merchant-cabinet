"""Admin router — only accessible to admin users."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.dependencies import get_user_service, require_admin
from services.user import UserService
from models import User


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

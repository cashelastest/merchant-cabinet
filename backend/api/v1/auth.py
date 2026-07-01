"""Auth router."""

import jwt
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import SECRET_KEY
from core.dependencies import get_user_service, get_current_user, get_session
from services.user import UserService
from services.bizon import BizonService
from schemas import LoginRequest, TokenResponse
from models import User, ApiKeyLog
from repositories.user import UserRepository


class StatusUpdate(BaseModel):
    is_active: bool


router = APIRouter(prefix="/auth")


def _create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(UTC) + timedelta(days=7)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, service: UserService = Depends(get_user_service)):
    user = await service.authenticate(data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=_create_token(user.id))


@router.get("/me")
async def me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return {
        "id": user.id,
        "username": user.username,
        "balance": float(user.balance),
        "is_active": user.is_active,
        "currencies": [c.xml for c in user.currencies],
    }


@router.patch("/me/status")
async def update_status(
    data: StatusUpdate,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    updated = await service.set_active(user, data.is_active)
    return {
        "id": updated.id,
        "username": updated.username,
        "is_active": updated.is_active,
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "username": user.username,
        "balance": 0,
        "is_active": user.is_active,
        "currencies": [c.xml for c in user.currencies],
    }


@router.get("/users")
async def list_users(
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = UserRepository(session)
    users = await repo.get_all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "balance": 0,
            "is_active": u.is_active,
            "currencies": [c.xml for c in u.currencies],
        }
        for u in users
    ]

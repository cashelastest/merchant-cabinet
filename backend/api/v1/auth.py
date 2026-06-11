"""Auth router."""

import jwt
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, HTTPException
from decimal import Decimal
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from core.config import SECRET_KEY
from core.dependencies import get_user_service, get_current_user
from services.user import UserService
from services.bizon import BizonService
from schemas import CreateUserRequest, LoginRequest, TokenResponse
from models import User


class StatusUpdate(BaseModel):
    is_active: bool


class CurrenciesUpdate(BaseModel):
    currencies: list[str]


router = APIRouter(prefix="/auth")


def _create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(UTC) + timedelta(days=7)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


@router.post("/register", response_model=TokenResponse)
async def register(data: CreateUserRequest, service: UserService = Depends(get_user_service)):
    try:
        user = await service.create_user(data)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Username already taken")
    return TokenResponse(access_token=_create_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, service: UserService = Depends(get_user_service)):
    user = await service.authenticate(data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=_create_token(user.id))


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    balance = 0.0
    try:
        data = await BizonService.get_wallets_balance(user.api_key, user.secret)
        wallets = data.get("wallets", [])
        wallet = wallets[-1] if wallets else {}
        balance = float(wallet.get("balance", 0))
    except Exception:
        pass
    return {
        "id": user.id,
        "username": user.username,
        "balance": balance,
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


@router.patch("/me/currencies")
async def update_currencies(
    data: CurrenciesUpdate,
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    updated = await service.update_currencies(user, data.currencies)
    return {
        "id": updated.id,
        "username": updated.username,
        "currencies": [c.xml for c in updated.currencies],
    }

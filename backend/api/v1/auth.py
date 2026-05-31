"""Auth router."""

import jwt
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, HTTPException

from core.config import SECRET_KEY
from core.dependencies import get_user_service
from services.user import UserService
from schemas import CreateUserRequest, TokenResponse

router = APIRouter(prefix="/auth")


def _create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(UTC) + timedelta(days=7)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


@router.post("/register", response_model=TokenResponse)
async def register(data: CreateUserRequest, service: UserService = Depends(get_user_service)):
    user = await service.create_user(data)
    return TokenResponse(access_token=_create_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(data: CreateUserRequest, service: UserService = Depends(get_user_service)):
    user = await service.authenticate(data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=_create_token(user.id))

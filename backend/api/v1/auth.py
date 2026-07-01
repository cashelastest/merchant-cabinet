"""Auth router."""

import jwt
import secrets
import qrcode
import io
import base64
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import pyotp

from core.config import SECRET_KEY
from core.dependencies import get_user_service, get_current_user, get_session
from services.user import UserService
from services.bizon import BizonService
from schemas import LoginRequest, TokenResponse
from models import User, ApiKeyLog
from repositories.user import UserRepository


class StatusUpdate(BaseModel):
    is_active: bool


class TwoFAVerify(BaseModel):
    code: str


class TwoFASetupVerify(BaseModel):
    code: str
    secret: str


class UserSettings(BaseModel):
    api_key: str
    is_2fa_enabled: bool


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


@router.get("/user-settings", response_model=UserSettings)
async def get_user_settings(user: User = Depends(get_current_user)):
    api_key = user.api_key or ""
    is_2fa_enabled = bool(user.totp_secret)
    return UserSettings(api_key=api_key, is_2fa_enabled=is_2fa_enabled)


@router.post("/generate-api-key")
async def generate_api_key(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user.api_key = secrets.token_urlsafe(32)
    await session.commit()
    return {"api_key": user.api_key}


@router.post("/2fa/setup")
async def setup_2fa(user: User = Depends(get_current_user)):
    if user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA already enabled")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp.provisioning_uri(name=user.username, issuer_name="Merchant Cabinet"))
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)
    qr_base64 = base64.b64encode(img_byte_arr.getvalue()).decode()
    qr_url = f"data:image/png;base64,{qr_base64}"

    return {"qr_code_url": qr_url, "secret": secret}


@router.post("/2fa/verify-setup")
async def verify_2fa_setup(
    data: TwoFASetupVerify,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA already enabled")

    if not data.secret or not data.code:
        raise HTTPException(status_code=400, detail="Invalid setup")

    totp = pyotp.TOTP(data.secret)
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid code")

    user.totp_secret = data.secret
    await session.commit()
    return {"status": "2fa_enabled"}


@router.post("/2fa/disable")
async def disable_2fa(
    data: TwoFAVerify,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not enabled")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid code")

    user.totp_secret = None
    await session.commit()
    return {"status": "2fa_disabled"}

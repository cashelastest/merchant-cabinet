import jwt
from fastapi import Depends, Header, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from redis.asyncio import Redis
from typing import AsyncGenerator

from core.config import DATABASE_URL, REDIS_URL, SECRET_KEY
from models import User
from repositories.deal import DealRepository
from repositories.user import UserRepository
from services.deal import DealService
from services.redis import RedisService
from services.user import UserService

engine = create_async_engine(DATABASE_URL)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

redis_client = Redis.from_url(REDIS_URL)
redis_service = RedisService(redis_client)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


def get_deal_service(session: AsyncSession = Depends(get_session)) -> DealService:
    return DealService(DealRepository(session))


def get_user_service(session: AsyncSession = Depends(get_session)) -> UserService:
    return UserService(UserRepository(session))


def _decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")


def _reject_banned(user: User) -> User:
    # 401 rather than 403 on purpose: both frontend clients drop the stored token
    # and send the user to the login page on 401, so a banned session ends at
    # once instead of lingering with every request failing. Login answers 403.
    if user.is_banned:
        raise HTTPException(status_code=401, detail="User is banned")
    return user


async def get_current_user(
    authorization: str = Header(),
    session: AsyncSession = Depends(get_session),
) -> User:
    user_id = _decode_token(authorization.removeprefix("Bearer "))
    user = await UserRepository(session).get_with_currencies(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return _reject_banned(user)


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_current_user_ws(
    token: str = Query(),
    session: AsyncSession = Depends(get_session),
) -> User:
    user_id = _decode_token(token)
    user = await UserRepository(session).get_with_currencies(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return _reject_banned(user)


async def get_user_by_api_key(
    x_api_key: str = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")

    repo = UserRepository(session)
    user = await repo.get_by_api_key(x_api_key)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return _reject_banned(user)


async def get_current_user_or_by_api_key(
    authorization: str = Header(default=None),
    x_api_key: str = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    repo = UserRepository(session)

    if x_api_key:
        user = await repo.get_by_api_key(x_api_key)
        if user:
            return _reject_banned(user)
        raise HTTPException(status_code=401, detail="Invalid API key")

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization or X-API-Key header")

    user = None
    try:
        user_id = _decode_token(authorization)
        user = await repo.get_with_currencies(user_id)
    except HTTPException:
        pass

    # Checked outside the try: inside it the ban error would be swallowed and
    # reported as plain "Invalid credentials".
    if user:
        return _reject_banned(user)
    raise HTTPException(status_code=401, detail="Invalid credentials")

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


async def get_current_user(
    authorization: str = Header(),
    session: AsyncSession = Depends(get_session),
) -> User:
    user_id = _decode_token(authorization.removeprefix("Bearer "))
    user = await UserRepository(session).get_with_currencies(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user_ws(
    token: str = Query(),
    session: AsyncSession = Depends(get_session),
) -> User:
    user_id = _decode_token(token)
    user = await UserRepository(session).get_with_currencies(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

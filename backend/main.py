import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.dependencies import engine, redis_service, SessionLocal
from core.config import ADMIN_USERNAME, ADMIN_PASSWORD
from models.base import Base
from models import User
from repositories.user import UserRepository
from services.user import UserService
from schemas import CreateUserRequest
from api.v1.deal import router as deal_router
from api.v1.auth import router as auth_router
from api.v1.admin import router as admin_router


async def _ensure_admin() -> None:
    async with SessionLocal() as session:
        repo = UserRepository(session)
        existing = await repo.get_by_username(ADMIN_USERNAME)
        if not existing:
            data = CreateUserRequest(username=ADMIN_USERNAME, password=ADMIN_PASSWORD)
            service = UserService(repo)
            user = await service.create_user(data)
            user.is_admin = True
            await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_admin()
    asyncio.create_task(redis_service.listen())
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(deal_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")

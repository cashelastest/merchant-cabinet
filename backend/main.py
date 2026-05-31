import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

from core.dependencies import redis_service
from api.v1.deal import router as deal_router
from api.v1.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(redis_service.listen())
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(deal_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")

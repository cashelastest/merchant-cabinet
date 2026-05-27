"""Base repository module."""

from abc import ABC
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Generic, TypeVar

T = TypeVar("T")

class BaseRepository(ABC, Generic[T]):
    "Base repository for all repositories"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
    
    async def save(self, obj: T) -> T:
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

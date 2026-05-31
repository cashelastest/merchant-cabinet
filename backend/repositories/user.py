from sqlalchemy import select
from sqlalchemy.orm import selectinload
from models import User
from .base import BaseRepository


class UserRepository(BaseRepository[User]):

    async def get_by_username(self, username: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_with_currencies(self, user_id: int) -> User | None:
        result = await self.session.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.currencies))
        )
        return result.scalar_one_or_none()
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from models import User
from models.currency import Currency
from .base import BaseRepository
from typing import List


class UserRepository(BaseRepository[User]):

    async def get_all(self) -> List[User]:
        result = await self.session.execute(
            select(User).options(selectinload(User.currencies))
        )
        return list(result.scalars().all())

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

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

    async def get_by_api_key(self, api_key: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.api_key == api_key).options(selectinload(User.currencies))
        )
        return result.scalar_one_or_none()

    async def set_currencies(self, user: User, xml_codes: list[str]) -> User:
        currencies = []
        for xml in xml_codes:
            result = await self.session.execute(
                select(Currency).where(Currency.xml == xml)
            )
            currency = result.scalar_one_or_none()
            if not currency:
                currency = Currency(title=xml, xml=xml)
                self.session.add(currency)
                await self.session.flush()
            currencies.append(currency)
        user.currencies = currencies
        await self.session.flush()
        return user
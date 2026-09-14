from decimal import Decimal
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from models import User
from models.currency import Currency
from models.user_currency_markup import UserCurrencyMarkup
from .base import BaseRepository
from typing import List


class UserRepository(BaseRepository[User]):

    async def get_all(self) -> List[User]:
        # Ordering is not cosmetic here: without it Postgres returns rows in an
        # arbitrary order that shifts after updates, which both reshuffles the
        # admin list and makes deal-to-merchant matching non-deterministic.
        result = await self.session.execute(
            select(User).options(selectinload(User.currencies)).order_by(User.id)
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

    async def get_markup(self, user_id: int, currency_xml: str) -> Decimal:
        """Markup percent for one merchant and payout currency; 0 when unset."""
        result = await self.session.execute(
            select(UserCurrencyMarkup.percent).where(
                UserCurrencyMarkup.user_id == user_id,
                UserCurrencyMarkup.currency_xml == currency_xml,
            )
        )
        percent = result.scalar_one_or_none()
        return percent if percent is not None else Decimal("0")

    async def get_markups(self, user_ids: list[int]) -> dict[int, dict[str, Decimal]]:
        """Markups of many users in one query: {user_id: {currency_xml: percent}}."""
        if not user_ids:
            return {}
        result = await self.session.execute(
            select(UserCurrencyMarkup).where(UserCurrencyMarkup.user_id.in_(user_ids))
        )
        markups: dict[int, dict[str, Decimal]] = {}
        for m in result.scalars().all():
            markups.setdefault(m.user_id, {})[m.currency_xml] = m.percent
        return markups

    async def replace_markups(self, user_id: int, markups: dict[str, Decimal]) -> None:
        """Replaces the user's whole markup set with the given one."""
        await self.session.execute(
            delete(UserCurrencyMarkup).where(UserCurrencyMarkup.user_id == user_id)
        )
        for currency_xml, percent in markups.items():
            self.session.add(
                UserCurrencyMarkup(user_id=user_id, currency_xml=currency_xml, percent=percent)
            )
        await self.session.flush()

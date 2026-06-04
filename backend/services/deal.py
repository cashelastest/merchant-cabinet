from decimal import Decimal
from datetime import datetime
from typing import Optional

from .base import BaseService
from repositories.deal import DealRepository
from schemas import DealCreateRequest
from models import Deal, User


def _utcnow() -> datetime:
    return datetime.utcnow()


def _strip_tz(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


class DealService(BaseService):

    def __init__(self, repository: DealRepository) -> None:
        super().__init__(repository)

    repository: DealRepository

    async def create(self, deal_data: DealCreateRequest) -> Deal:
        data = deal_data.model_dump()
        if isinstance(data.get("created_at"), datetime):
            data["created_at"] = _strip_tz(data["created_at"])
        deal = Deal(**data)
        deal.received_at = _utcnow()
        deal = await self.repository.save(deal)
        await self.repository.session.commit()
        return deal

    async def list_deals(
        self,
        user: User,
        deal_id: Optional[int] = None,
        status: Optional[str] = None,
        from_xml: Optional[str] = None,
    ) -> list[Deal]:
        user_xml_codes = {c.xml for c in user.currencies} if user.currencies else None
        return await self.repository.get_all(deal_id, status, from_xml, user_xml_codes)

    async def accept(self, deal_id: int, user_id: int) -> Deal:
        deal = await self.repository.get_by_id(deal_id)
        if not deal:
            raise ValueError("not_found")
        if deal.accepted_by is not None:
            raise ValueError("already_accepted")

        user = await self.repository.session.get(User, user_id)
        if not user:
            raise ValueError("user_not_found")

        amount = Decimal(str(deal.to_values.get("outAmount", 0)))

        deal.accepted_by = user_id
        deal.accepted_at = _utcnow()
        deal.status = "accepted"
        user.balance += amount

        await self.repository.session.commit()
        return deal

    async def refuse(self, deal_id: int, user_id: int) -> Deal:
        deal = await self.repository.get_by_id(deal_id)
        if not deal:
            raise ValueError("not_found")
        if deal.accepted_by is not None:
            raise ValueError("already_accepted")

        deal.accepted_by = user_id
        deal.accepted_at = _utcnow()
        deal.status = "refused"

        await self.repository.session.commit()
        return deal

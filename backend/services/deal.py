from decimal import Decimal
from datetime import datetime, UTC

from .base import BaseService
from repositories.deal import DealRepository
from schemas import DealCreateRequest
from models import Deal, User


class DealService(BaseService):

    def __init__(self, repository: DealRepository) -> None:
        super().__init__(repository)

    repository: DealRepository

    async def create(self, deal_data: DealCreateRequest) -> Deal:
        deal = Deal(**deal_data.model_dump())
        deal.received_at = datetime.now(UTC)
        deal = await self.repository.save(deal)
        await self.repository.session.commit()
        return deal

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
        deal.accepted_at = datetime.now(UTC)
        deal.status = "accepted"
        user.balance += amount

        await self.repository.session.commit()
        return deal

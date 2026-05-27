from .base import BaseService
from schemas import DealCreateRequest
from models import Deal
from datetime import datetime, UTC


class DealService(BaseService):
    
    async def create(self, deal_data: DealCreateRequest):
        deal = Deal(**deal_data.model_dump())
        deal.received_at = datetime.now(UTC)
        await self.repository.save(deal)
        await self.repository.session.commit()
    
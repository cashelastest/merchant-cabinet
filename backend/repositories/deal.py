from sqlalchemy import select
from models import Deal
from .base import BaseRepository


class DealRepository(BaseRepository[Deal]):

    async def get_by_id(self, deal_id: int) -> Deal | None:
        result = await self.session.execute(select(Deal).where(Deal.id == deal_id))
        return result.scalar_one_or_none()
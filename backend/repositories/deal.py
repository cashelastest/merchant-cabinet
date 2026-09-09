from sqlalchemy import select
from typing import Optional
from models import Deal
from .base import BaseRepository


class DealRepository(BaseRepository[Deal]):

    async def get_by_id(self, deal_id: int) -> Deal | None:
        result = await self.session.execute(select(Deal).where(Deal.id == deal_id))
        return result.scalar_one_or_none()

    async def get_all(
        self,
        deal_id: Optional[int] = None,
        status: Optional[str] = None,
        to_xml: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> list[Deal]:
        query = select(Deal)
        if deal_id is not None:
            query = query.where(Deal.id == deal_id)
        if status:
            query = query.where(Deal.status == status)
        if to_xml:
            # Filtering is on the payout currency, the one merchants work in.
            query = query.where(Deal.to_xml == to_xml)
        if user_id:
            query = query.where(Deal.user_id == user_id)
        query = query.order_by(Deal.received_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())
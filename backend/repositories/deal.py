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
        from_xml: Optional[str] = None,
        user_xml_codes: Optional[set[str]] = None,
    ) -> list[Deal]:
        query = select(Deal)
        if deal_id is not None:
            query = query.where(Deal.id == deal_id)
        if status:
            query = query.where(Deal.status == status)
        if from_xml:
            query = query.where(Deal.from_xml == from_xml)
        elif user_xml_codes:
            query = query.where(Deal.from_xml.in_(user_xml_codes))
        query = query.order_by(Deal.received_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())
from datetime import datetime
from sqlalchemy import select, or_, and_
from sqlalchemy.exc import IntegrityError
from typing import Optional
from models import Deal, DealRefusal
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
        viewer_id: Optional[int] = None,
        viewer_xml_codes: Optional[set[str]] = None,
    ) -> list[Deal]:
        query = select(Deal)
        if deal_id is not None:
            query = query.where(Deal.id == deal_id)
        if status:
            query = query.where(Deal.status == status)
        if to_xml:
            # Filtering is on the payout currency, the one merchants work in.
            query = query.where(Deal.to_xml == to_xml)
        if viewer_id is not None:
            # A merchant sees the shared pool — pending deals in any of their payout
            # currencies that they haven't refused — plus every deal they took
            # themselves. Deals taken by another merchant drop out of the list.
            visible = Deal.accepted_by == viewer_id
            if viewer_xml_codes:
                refused_by_viewer = (
                    select(DealRefusal.id)
                    .where(DealRefusal.deal_id == Deal.id, DealRefusal.user_id == viewer_id)
                    .exists()
                )
                visible = or_(
                    visible,
                    and_(
                        Deal.status == "pending",
                        Deal.to_xml.in_(viewer_xml_codes),
                        ~refused_by_viewer,
                    ),
                )
            query = query.where(visible)
        query = query.order_by(Deal.received_at.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def is_hidden_for(self, deal_id: int, user_id: int) -> bool:
        """Whether this merchant has refused the deal."""
        result = await self.session.execute(
            select(DealRefusal.id).where(DealRefusal.deal_id == deal_id, DealRefusal.user_id == user_id)
        )
        return result.first() is not None

    async def hide_for(self, deal_id: int, user_id: int) -> None:
        """Records a merchant's refusal. Refusing the same deal twice is a no-op."""
        if await self.is_hidden_for(deal_id, user_id):
            return
        try:
            # A savepoint, so a concurrent duplicate only undoes this one insert.
            async with self.session.begin_nested():
                self.session.add(DealRefusal(deal_id=deal_id, user_id=user_id, created_at=datetime.utcnow()))
        except IntegrityError:
            pass

    async def refusals_by(self, user_id: int) -> list[tuple[Deal, datetime]]:
        """Deals a merchant refused, each with the moment they refused it."""
        result = await self.session.execute(
            select(Deal, DealRefusal.created_at)
            .join(DealRefusal, DealRefusal.deal_id == Deal.id)
            .where(DealRefusal.user_id == user_id)
        )
        return [(deal, refused_at) for deal, refused_at in result.all()]

from datetime import datetime
from decimal import Decimal
from sqlalchemy import select
from models.payout import Payout
from .base import BaseRepository


class PayoutRepository(BaseRepository[Payout]):

    async def create(
        self,
        user_id: int,
        amount: Decimal,
        currency: str = "USDT",
        card_holder: str = None,
        card_number: str = None,
        phone_number: str = None,
        bank_name: str = None,
    ) -> Payout:
        payout = Payout(
            user_id=user_id,
            amount=amount,
            currency=currency,
            card_holder=card_holder,
            card_number=card_number,
            phone_number=phone_number,
            bank_name=bank_name,
            status="pending",
            created_at=datetime.utcnow(),
        )
        self.session.add(payout)
        await self.session.flush()
        return payout

    async def get_by_user(self, user_id: int) -> list[Payout]:
        result = await self.session.execute(
            select(Payout).where(Payout.user_id == user_id).order_by(Payout.created_at.desc())
        )
        return list(result.scalars().all())

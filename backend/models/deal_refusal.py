"""A merchant's "not for me" on a deal from the shared pool."""

from datetime import datetime
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class DealRefusal(Base):
    """Hides one deal from one merchant; every other merchant still sees it.

    Refusing never changes the deal itself and is not reported to Bizon: the
    deal stays open for the rest of the merchants with its payout currency.
    """

    __tablename__ = "deal_refusals"
    __table_args__ = (
        UniqueConstraint("deal_id", "user_id", name="uq_refusal_deal_user"),
    )

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deal.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime]

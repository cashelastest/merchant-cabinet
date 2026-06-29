from .base import Base
from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from decimal import Decimal
from datetime import datetime


class Payout(Base):
    __tablename__ = "payouts"

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    wallet_address: Mapped[str]
    currency: Mapped[str] = mapped_column(server_default="USDT")
    status: Mapped[str] = mapped_column(server_default="pending")
    created_at: Mapped[datetime]

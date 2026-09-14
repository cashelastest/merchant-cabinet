"""Deal model definition."""

from .base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from typing import Optional
from decimal import Decimal
from datetime import datetime


class Deal(Base):
    __tablename__ = "deal"

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    uid: Mapped[int]
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    bizon_id: Mapped[Optional[str]] = mapped_column(nullable=True)
    secret: Mapped[str]
    to_values: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    from_xml: Mapped[str]
    from_name: Mapped[str]
    from_image_url: Mapped[str]
    to_xml: Mapped[str]
    to_name: Mapped[str]
    to_image_xml: Mapped[str]
    status: Mapped[str]
    accepted_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    accepted_at: Mapped[Optional[datetime]]
    received_at: Mapped[Optional[datetime]]
    created_at: Mapped[datetime]
    updated_at: Mapped[Optional[datetime]]
    receipt_url: Mapped[Optional[str]] = mapped_column(nullable=True)

    # Exchange rate as sent by the API caller: payout-currency units per 1 USDT.
    rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    # The merchant's markup for to_xml at creation time, and the rate with it
    # applied. Stored rather than computed on read, so changing a markup later
    # does not rewrite the rate of deals that have already happened.
    markup_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4), nullable=True)
    our_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)

    # USDT settlement, filled in when the payout is completed:
    #   turnover = outAmount / rate      the payout valued at the caller's rate
    #   credited = outAmount / our_rate  what lands on the merchant's balance
    #   margin   = turnover - credited
    turnover_usdt: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    credited_usdt: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    margin_usdt: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)

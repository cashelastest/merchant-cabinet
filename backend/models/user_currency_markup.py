"""Per-merchant markup on the exchange rate, per payout currency."""

from decimal import Decimal
from sqlalchemy import ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class UserCurrencyMarkup(Base):
    """Percent added on top of the API caller's rate for one merchant and currency.

    Kept out of the user_currencies association table on purpose: saving a
    merchant's currencies rebuilds that association (delete + re-insert), which
    would wipe any markup stored alongside it.
    """

    __tablename__ = "user_currency_markups"
    __table_args__ = (
        UniqueConstraint("user_id", "currency_xml", name="uq_markup_user_currency"),
    )

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    currency_xml: Mapped[str]
    percent: Mapped[Decimal] = mapped_column(Numeric(8, 4), server_default="0")

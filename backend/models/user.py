from decimal import Decimal
from .base import Base, user_currencies_table
from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from .currency import Currency


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    hashed_password: Mapped[str]
    api_key: Mapped[str]
    secret: Mapped[str]
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), server_default="0")
    is_active: Mapped[bool] = mapped_column(server_default="false")
    is_admin: Mapped[bool] = mapped_column(server_default="false")
    # Set by an admin. Unlike is_active (the merchant's own pause switch), a ban
    # blocks login, the API key, websockets and deal assignment.
    is_banned: Mapped[bool] = mapped_column(server_default="false")
    totp_secret: Mapped[Optional[str]] = mapped_column(nullable=True)

    currencies: Mapped[List['Currency']] = relationship(
        secondary=user_currencies_table,
        back_populates="users"
    )

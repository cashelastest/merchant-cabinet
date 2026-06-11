from decimal import Decimal
from .base import Base, user_currencies_table
from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, List

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
    is_active: Mapped[bool] = mapped_column(server_default="true")
    is_admin: Mapped[bool] = mapped_column(server_default="false")

    currencies: Mapped[List['Currency']] = relationship(
        secondary=user_currencies_table,
        back_populates="users"
    )

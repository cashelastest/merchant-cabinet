from .base import Base, user_currencies_table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from .currency import Currency


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    username: Mapped[str] = mapped_column(unique=True)
    hashed_password: Mapped[str]

    currencies: Mapped[List['Currency']] = relationship(
        secondary=user_currencies_table,
        back_populates="users"
    )

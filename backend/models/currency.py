from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, user_currencies_table
from typing import TYPE_CHECKING, List
if TYPE_CHECKING:
    from .user import User

class Currency(Base):
    __tablename__ = "currencies"

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    title: Mapped[str]
    xml: Mapped[str]
    
    users: Mapped[List['User']] = relationship(
        secondary=user_currencies_table,
        back_populates="currencies"
    )
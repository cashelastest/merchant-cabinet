from datetime import datetime
from .base import Base
from sqlalchemy.orm import Mapped, mapped_column


class ApiKeyLog(Base):
    __tablename__ = "api_key_log"

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    username: Mapped[str]
    used_at: Mapped[datetime]
    purpose: Mapped[str]
    key_type: Mapped[str]  # "admin" | "user"

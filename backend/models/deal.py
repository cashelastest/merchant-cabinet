"""Deal model definition."""

from .base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from typing import TYPE_CHECKING, Optional
if TYPE_CHECKING:
    from .user import User
from datetime import datetime


class Deal (Base):
    __tablename__ = "deal"

    id: Mapped[int] = mapped_column(autoincrement=True, primary_key=True)
    uid: Mapped[int]
    secret: Mapped[str]
    to_values: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    from_xml: Mapped[str]
    from_name: Mapped[str]
    from_image_url: Mapped[str]
    to_xml: Mapped[str]
    to_name: Mapped[str]
    to_image_xml: Mapped[str]
    status: Mapped[str]
    accepted_by: Mapped[Optional['User']]
    accepted_at: Mapped[datetime]
    received_at: Mapped[datetime]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]



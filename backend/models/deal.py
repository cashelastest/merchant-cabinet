"""Deal model definition."""

from .base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from typing import Optional
from datetime import datetime


class Deal(Base):
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
    accepted_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    accepted_at: Mapped[Optional[datetime]]
    received_at: Mapped[Optional[datetime]]
    created_at: Mapped[datetime]
    updated_at: Mapped[Optional[datetime]]



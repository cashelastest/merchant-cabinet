"""Deal request schemas."""

from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime


class DealCreateRequest(BaseModel):
    uid: int
    bizon_id: Optional[str] = None
    secret: str
    to_values: Dict
    from_xml: str
    from_name: str
    from_image_url: str
    to_xml: str
    to_name: str
    to_image_xml: str
    status: str
    created_at: datetime
    user_id: Optional[int] = None


class DealPublish(DealCreateRequest):
    id: int
    recieved_at: datetime


class DealResponse(BaseModel):
    id: int
    uid: int
    user_id: int
    bizon_id: Optional[str] = None
    secret: str
    to_values: Dict
    from_xml: str
    from_name: str
    from_image_url: str
    to_xml: str
    to_name: str
    to_image_xml: str
    status: str
    accepted_by: Optional[int] = None
    accepted_by_username: Optional[str] = None
    accepted_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

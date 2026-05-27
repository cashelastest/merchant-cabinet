"""Deal request schemas."""

from pydantic import BaseModel
from typing import Dict
from datetime import datetime


class DealCreateRequest(BaseModel):
    uid: int
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

class DealPublish(DealCreateRequest):
    id: int
    recieved_at: datetime

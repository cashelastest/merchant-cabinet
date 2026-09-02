"""Deal request schemas."""

from pydantic import BaseModel, field_validator
from typing import Dict, Optional
from datetime import datetime

from .deal_status import DealStatus


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

    @field_validator("status")
    @classmethod
    def status_known(cls, v: str) -> str:
        # An unknown status is a dead end: accept() only ever works from
        # "pending", so such a deal can never be processed. Reject it here
        # instead of storing a row nothing downstream can handle.
        allowed = {s.value for s in DealStatus}
        if v not in allowed:
            raise ValueError(f"Unknown status '{v}'. Allowed: {', '.join(sorted(allowed))}")
        return v


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
    receipt_url: Optional[str] = None

    model_config = {"from_attributes": True}

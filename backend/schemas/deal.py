"""Deal request schemas."""

from decimal import Decimal
from pydantic import BaseModel, field_validator
from typing import Dict, Optional
from datetime import datetime

from .deal_status import DealStatus

# deal.rate is NUMERIC(18, 8): at most 10 integer digits and 8 decimals.
RATE_QUANT = Decimal("0.00000001")
RATE_MAX = Decimal("10000000000")


class DealCreateRequest(BaseModel):
    uid: int
    bizon_id: Optional[str] = None
    secret: str
    to_values: Dict
    from_xml: str = ""
    from_name: str = ""
    from_image_url: str = ""
    to_xml: str
    to_name: str = ""
    to_image_xml: str = ""
    status: str
    # The caller's own exchange rate. The merchant's markup is applied on top.
    rate: Decimal
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

    @field_validator("rate")
    @classmethod
    def rate_valid(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Rate must be positive")
        if v >= RATE_MAX:
            raise ValueError("Rate is too large")
        # Rounded rather than rejected: exchangers often send more decimals.
        return v.quantize(RATE_QUANT)


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
    # Merchants only get the rate with their markup applied; the caller's rate
    # and the markup itself stay on the admin side.
    our_rate: Optional[float] = None

    model_config = {"from_attributes": True}

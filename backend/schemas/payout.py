from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import datetime


class PayoutRequest(BaseModel):
    amount: Decimal
    wallet_address: str
    currency: str = "USDT"

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class PayoutResponse(BaseModel):
    id: int
    amount: float
    wallet_address: str
    status: str
    created_at: datetime
    redirect_url: str

    model_config = {"from_attributes": True}

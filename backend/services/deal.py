from decimal import Decimal
from datetime import datetime
from typing import Optional

from .base import BaseService
from .bizon import BizonService
from repositories.deal import DealRepository
from schemas import DealCreateRequest
from models import Deal, User, ApiKeyLog
from core.config import BIZON_ADMIN_API_KEY, BIZON_ADMIN_SECRET


def _utcnow() -> datetime:
    return datetime.utcnow()


def _strip_tz(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


class DealService(BaseService):

    def __init__(self, repository: DealRepository) -> None:
        super().__init__(repository)

    repository: DealRepository

    async def create(self, deal_data: DealCreateRequest) -> Deal:
        data = deal_data.model_dump()
        if isinstance(data.get("created_at"), datetime):
            data["created_at"] = _strip_tz(data["created_at"])
        deal = Deal(**data)
        deal.received_at = _utcnow()
        deal = await self.repository.save(deal)
        await self.repository.session.commit()
        return deal

    async def list_deals(
        self,
        user: User,
        deal_id: Optional[int] = None,
        status: Optional[str] = None,
        to_xml: Optional[str] = None,
    ) -> list[Deal]:
        return await self.repository.get_all(deal_id, status, to_xml, user.id)

    async def accept(self, deal_id: int, user_id: int) -> Deal:
        deal = await self.repository.get_by_id(deal_id)
        if not deal:
            raise ValueError("not_found")
        if deal.status != "pending":
            raise ValueError("already_accepted")

        user = await self.repository.session.get(User, user_id)
        if deal.bizon_id and BIZON_ADMIN_API_KEY:
            try:
                await BizonService.update_order_status(
                    BIZON_ADMIN_API_KEY, BIZON_ADMIN_SECRET, deal.bizon_id, "inProgress"
                )
                log = ApiKeyLog(
                    username=user.username if user else str(user_id),
                    used_at=_utcnow(),
                    purpose=f"accept_deal #{deal.id}",
                    key_type="admin",
                )
                self.repository.session.add(log)
            except Exception:
                pass

        deal.accepted_by = user_id
        deal.accepted_at = _utcnow()
        deal.status = "in_progress"

        await self.repository.session.commit()
        return deal

    async def complete(self, deal_id: int, user_id: int) -> Deal:
        deal = await self.repository.get_by_id(deal_id)
        if not deal:
            raise ValueError("not_found")
        if deal.status != "in_progress" or deal.accepted_by != user_id:
            raise ValueError("not_allowed")

        user = await self.repository.session.get(User, user_id)
        if not user:
            raise ValueError("user_not_found")

        if deal.bizon_id and BIZON_ADMIN_API_KEY:
            try:
                await BizonService.update_order_status(
                    BIZON_ADMIN_API_KEY, BIZON_ADMIN_SECRET, deal.bizon_id, "done"
                )
                log = ApiKeyLog(
                    username=user.username,
                    used_at=_utcnow(),
                    purpose=f"complete_deal #{deal.id}",
                    key_type="admin",
                )
                self.repository.session.add(log)
            except Exception:
                pass

        amount = Decimal(str(deal.to_values.get("outAmount", 0)))
        deal.status = "accepted"
        deal.updated_at = _utcnow()
        user.balance += amount

        await self.repository.session.commit()
        return deal

    async def refuse(self, deal_id: int, user_id: int) -> Deal:
        deal = await self.repository.get_by_id(deal_id)
        if not deal:
            raise ValueError("not_found")
        if deal.status not in ("pending", "in_progress"):
            raise ValueError("already_accepted")
        if deal.status == "in_progress" and deal.accepted_by != user_id:
            raise ValueError("not_allowed")

        user = await self.repository.session.get(User, user_id)
        if deal.bizon_id and BIZON_ADMIN_API_KEY:
            try:
                await BizonService.update_order_status(
                    BIZON_ADMIN_API_KEY, BIZON_ADMIN_SECRET, deal.bizon_id, "errorPayment"
                )
                log = ApiKeyLog(
                    username=user.username if user else str(user_id),
                    used_at=_utcnow(),
                    purpose=f"refuse_deal #{deal.id}",
                    key_type="admin",
                )
                self.repository.session.add(log)
            except Exception:
                pass

        deal.accepted_by = user_id
        deal.accepted_at = _utcnow()
        deal.status = "refused"
        deal.updated_at = _utcnow()

        await self.repository.session.commit()
        return deal

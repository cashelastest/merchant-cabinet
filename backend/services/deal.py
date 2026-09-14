from decimal import Decimal, ROUND_DOWN
from datetime import datetime
from typing import Optional

from .base import BaseService
from .bizon import BizonService
from repositories.deal import DealRepository
from schemas import DealCreateRequest
from models import Deal, User, ApiKeyLog, BalanceHistory
from core.config import BIZON_ADMIN_API_KEY, BIZON_ADMIN_SECRET

# Merchant balances are kept in USDT.
BALANCE_CURRENCY = "USDT"
_CENT = Decimal("0.01")
_Q8 = Decimal("0.00000001")


def _utcnow() -> datetime:
    return datetime.utcnow()


def _strip_tz(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


def settle_deal(deal: Deal) -> tuple[Decimal, Decimal, Decimal]:
    """USDT settlement of a completed payout: (turnover, credited, margin).

    rate is "payout-currency units per 1 USDT". The recipient always gets
    outAmount; the merchant's balance is credited at our worsened rate:

      turnover = outAmount / rate       the payout valued at the caller's rate
      credited = outAmount / our_rate   what lands on the merchant's balance
      margin   = turnover - credited

    credited is rounded down to the cent so a balance is never over-credited;
    margin absorbs that remainder, which keeps turnover == credited + margin.
    """
    out_amount = Decimal(str((deal.to_values or {}).get("outAmount", 0)))
    rate, our_rate = deal.rate, deal.our_rate

    if rate is None or our_rate is None:
        # Deals created before rates existed. A USDT payout converts 1:1 exactly;
        # any other currency has nothing to convert with.
        if deal.to_xml != BALANCE_CURRENCY:
            raise ValueError("no_rate")
        rate = our_rate = Decimal(1)

    turnover = (out_amount / rate).quantize(_Q8)
    credited = (out_amount / our_rate).quantize(_CENT, rounding=ROUND_DOWN)
    return turnover, credited, turnover - credited


class DealService(BaseService):

    def __init__(self, repository: DealRepository) -> None:
        super().__init__(repository)

    repository: DealRepository

    async def create(
        self,
        deal_data: DealCreateRequest,
        markup_percent: Decimal = Decimal("0"),
        our_rate: Optional[Decimal] = None,
    ) -> Deal:
        data = deal_data.model_dump()
        if isinstance(data.get("created_at"), datetime):
            data["created_at"] = _strip_tz(data["created_at"])
        deal = Deal(**data)
        deal.markup_percent = markup_percent
        deal.our_rate = our_rate
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

        # Settle first: if the USDT amount can't be computed, the deal must not
        # be reported to Bizon as done.
        turnover, credited, margin = settle_deal(deal)

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

        deal.status = "accepted"
        deal.updated_at = _utcnow()
        deal.turnover_usdt = turnover
        deal.credited_usdt = credited
        deal.margin_usdt = margin
        user.balance += credited

        out_amount = (deal.to_values or {}).get("outAmount", 0)
        applied_rate = deal.our_rate if deal.our_rate is not None else 1
        self.repository.session.add(BalanceHistory(
            user_id=user.id,
            action="deal_accepted",
            amount=float(credited),
            reason=f"Deal #{deal.id}: {out_amount} {deal.to_xml} @ {applied_rate} = {credited} {BALANCE_CURRENCY}",
            created_at=datetime.now(),
        ))

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

from decimal import Decimal, ROUND_DOWN
from datetime import datetime
from typing import Optional

from sqlalchemy import update

from .base import BaseService
from .bizon import BizonService
from repositories.deal import DealRepository
from repositories.user import UserRepository
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


def apply_markup(rate: Optional[Decimal], markup_percent: Decimal) -> Optional[Decimal]:
    """The caller's rate worsened by a merchant's markup; None when there is no rate."""
    if rate is None:
        return None
    return (rate * (Decimal(100) + markup_percent) / Decimal(100)).quantize(_Q8)


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

    async def create(self, deal_data: DealCreateRequest) -> Deal:
        # No markup is fixed here: a new deal is visible to every merchant with
        # its currency, each with their own markup. It is fixed on accept().
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
        return await self.repository.get_all(
            deal_id,
            status,
            to_xml,
            viewer_id=user.id,
            viewer_xml_codes={c.xml for c in user.currencies},
        )

    async def _transition(self, deal_id: int, conditions: list, values: dict) -> bool:
        """Moves a deal to a new state only if it is still in the expected one.

        A single conditional UPDATE, so two concurrent requests can't both
        succeed. Returns False when the deal had already moved on.
        """
        result = await self.repository.session.execute(
            update(Deal)
            .where(Deal.id == deal_id, *conditions)
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        return result.rowcount == 1

    async def _sync_bizon(self, deal: Deal, username: str, bizon_status: str, purpose: str) -> None:
        """Reports a status change to Bizon. Called only after our own commit."""
        if not (deal.bizon_id and BIZON_ADMIN_API_KEY):
            return
        try:
            await BizonService.update_order_status(
                BIZON_ADMIN_API_KEY, BIZON_ADMIN_SECRET, deal.bizon_id, bizon_status
            )
            self.repository.session.add(ApiKeyLog(
                username=username, used_at=_utcnow(), purpose=purpose, key_type="admin",
            ))
            await self.repository.session.commit()
        except Exception:
            pass

    async def accept(self, deal_id: int, user_id: int) -> Deal:
        deal = await self.repository.get_by_id(deal_id)
        if not deal:
            raise ValueError("not_found")
        if deal.status != "pending":
            raise ValueError("already_accepted")

        users = UserRepository(self.repository.session)
        user = await users.get_with_currencies(user_id)
        if not user or deal.to_xml not in {c.xml for c in user.currencies}:
            # A pending deal is open to every merchant paying out in its currency,
            # and only to them.
            raise ValueError("not_allowed")
        if await self.repository.is_hidden_for(deal_id, user_id):
            # This merchant refused the deal, so it is no longer offered to them.
            raise ValueError("not_allowed")

        values = dict(status="in_progress", accepted_by=user_id, accepted_at=_utcnow())
        if deal.rate is not None:
            # Each merchant has their own markup, so it is fixed at the moment
            # someone takes the deal — and it is the taker's.
            markup_percent = await users.get_markup(user_id, deal.to_xml)
            values.update(markup_percent=markup_percent, our_rate=apply_markup(deal.rate, markup_percent))

        # Claim atomically: many merchants see the same pending deal and only the
        # first accept may win. Read-then-write would let two of them both "win".
        if not await self._transition(deal_id, [Deal.status == "pending"], values):
            await self.repository.session.rollback()
            raise ValueError("already_accepted")
        await self.repository.session.commit()
        await self.repository.session.refresh(deal)

        await self._sync_bizon(deal, user.username, "inProgress", f"accept_deal #{deal.id}")
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

        # Settle first: if the USDT amount can't be computed, nothing changes.
        turnover, credited, margin = settle_deal(deal)

        # Atomic as well: a double click or a retried request must not credit the
        # balance twice.
        if not await self._transition(
            deal_id,
            [Deal.status == "in_progress", Deal.accepted_by == user_id],
            dict(
                status="accepted",
                updated_at=_utcnow(),
                turnover_usdt=turnover,
                credited_usdt=credited,
                margin_usdt=margin,
            ),
        ):
            await self.repository.session.rollback()
            raise ValueError("not_allowed")

        # Incremented in SQL, not read-modify-write, so two deals of the same
        # merchant completing at once can't overwrite each other's credit.
        await self.repository.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(balance=User.balance + credited)
            .execution_options(synchronize_session=False)
        )

        out_amount = (deal.to_values or {}).get("outAmount", 0)
        applied_rate = deal.our_rate if deal.our_rate is not None else 1
        self.repository.session.add(BalanceHistory(
            user_id=user_id,
            action="deal_accepted",
            amount=float(credited),
            reason=f"Deal #{deal.id}: {out_amount} {deal.to_xml} @ {applied_rate} = {credited} {BALANCE_CURRENCY}",
            created_at=datetime.now(),
        ))

        await self.repository.session.commit()
        await self.repository.session.refresh(deal)

        # Reported to Bizon only once the credit is committed.
        await self._sync_bizon(deal, user.username, "done", f"complete_deal #{deal.id}")
        return deal

    async def refuse(self, deal_id: int, user_id: int) -> Deal:
        """"Not for me": hides the deal from this merchant only.

        The deal stays open for every other merchant with its currency, its status
        is not changed and nothing is sent to Bizon. A merchant who has already
        taken the deal hands it back to the pool.
        """
        deal = await self.repository.get_by_id(deal_id)
        if not deal:
            raise ValueError("not_found")
        if deal.status not in ("pending", "in_progress"):
            raise ValueError("already_accepted")

        users = UserRepository(self.repository.session)
        user = await users.get_with_currencies(user_id)
        if not user:
            raise ValueError("not_allowed")

        if deal.status == "in_progress":
            if deal.accepted_by != user_id:
                raise ValueError("not_allowed")
            if deal.receipt_url:
                # A receipt means the payout may already have been made; handing the
                # deal to another merchant could get it paid out twice.
                raise ValueError("has_receipt")
            # Back to the pool: the taker and the markup fixed for them are cleared,
            # so the next merchant who takes it gets their own.
            if not await self._transition(
                deal_id,
                [Deal.status == "in_progress", Deal.accepted_by == user_id],
                dict(status="pending", accepted_by=None, accepted_at=None, markup_percent=None, our_rate=None),
            ):
                await self.repository.session.rollback()
                raise ValueError("already_accepted")
        elif deal.to_xml not in {c.xml for c in user.currencies}:
            raise ValueError("not_allowed")

        await self.repository.hide_for(deal_id, user_id)
        await self.repository.session.commit()
        await self.repository.session.refresh(deal)
        return deal

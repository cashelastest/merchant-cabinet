"""Payout router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_session
from models import User
from repositories.payout import PayoutRepository
from schemas import PayoutRequest, PayoutResponse

router = APIRouter(prefix="/payout")


@router.post("/", response_model=PayoutResponse)
async def request_payout(
    data: PayoutRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user.balance += data.amount
    repo = PayoutRepository(session)
    payout = await repo.create(
        user.id,
        data.amount,
        data.wallet_address,
        data.currency,
        data.card_holder,
        data.card_number,
        data.phone_number,
        data.bank_name,
    )
    await session.commit()
    await session.refresh(payout)

    return PayoutResponse(
        id=payout.id,
        amount=float(payout.amount),
        wallet_address=payout.wallet_address,
        status=payout.status,
        created_at=payout.created_at,
        redirect_url="",
    )


@router.get("/", response_model=list[PayoutResponse])
async def list_payouts(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = PayoutRepository(session)
    payouts = await repo.get_by_user(user.id)
    return [
        PayoutResponse(
            id=p.id,
            amount=float(p.amount),
            wallet_address=p.wallet_address,
            currency=p.currency,
            card_holder=p.card_holder,
            card_number=p.card_number,
            phone_number=p.phone_number,
            bank_name=p.bank_name,
            status=p.status,
            created_at=p.created_at,
            redirect_url="",
        )
        for p in payouts
    ]


@router.patch("/{payout_id}/status")
async def update_payout_status(
    payout_id: int,
    status: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from models import Payout
    from sqlalchemy import select

    stmt = select(Payout).where(
        (Payout.id == payout_id) & (Payout.user_id == user.id)
    )
    result = await session.execute(stmt)
    payout = result.scalar_one_or_none()

    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    payout.status = status
    await session.commit()
    await session.refresh(payout)

    return PayoutResponse(
        id=payout.id,
        amount=float(payout.amount),
        wallet_address=payout.wallet_address,
        currency=payout.currency,
        card_holder=payout.card_holder,
        card_number=payout.card_number,
        phone_number=payout.phone_number,
        bank_name=payout.bank_name,
        status=payout.status,
        created_at=payout.created_at,
        redirect_url="",
    )

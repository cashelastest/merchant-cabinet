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
    if user.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    user.balance -= data.amount
    repo = PayoutRepository(session)
    payout = await repo.create(user.id, data.amount, data.wallet_address, data.currency)
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
            status=p.status,
            created_at=p.created_at,
            redirect_url="",
        )
        for p in payouts
    ]

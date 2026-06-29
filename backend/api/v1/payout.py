"""Payout router."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_session
from core.config import BPAY_URL
from models import User
from repositories.payout import PayoutRepository
from schemas import PayoutRequest, PayoutResponse
from services.bizon import BizonService

router = APIRouter(prefix="/payout")


@router.post("/", response_model=PayoutResponse)
async def request_payout(
    data: PayoutRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.balance < data.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    route_id = await BizonService.find_payout_route(data.currency)
    if not route_id:
        wallet_type = "CASHUSD_wallet" if data.currency == "CASHUSD" else "USDT_wallet"
        raise HTTPException(status_code=404, detail=f"No {data.currency} → {wallet_type} payout route found")

    # Create Bizon order
    try:
        order = await BizonService.create_order(
            api_key=user.api_key,
            secret=user.secret,
            route_id=route_id,
            amount=data.amount,
            wallet_address=data.wallet_address,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    uid = order.get("uid")
    secret = order.get("secret", "")

    if not uid:
        raise HTTPException(status_code=502, detail="Invalid response from payment provider")

    redirect_url = f"{BPAY_URL}/payment?uid={uid}&secret={secret}"

    # Deduct balance and record payout
    user.balance -= data.amount
    repo = PayoutRepository(session)
    payout = await repo.create(user.id, data.amount, data.wallet_address)
    await session.commit()
    await session.refresh(payout)

    return PayoutResponse(
        id=payout.id,
        amount=float(payout.amount),
        wallet_address=payout.wallet_address,
        status=payout.status,
        created_at=payout.created_at,
        redirect_url=redirect_url,
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

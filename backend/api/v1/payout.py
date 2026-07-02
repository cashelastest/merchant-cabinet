"""Payout router."""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
import json
import aiofiles
from pathlib import Path

from core.dependencies import get_current_user, get_session, _decode_token, SessionLocal, get_current_user_or_by_api_key
from models import User, BalanceHistory
from repositories.payout import PayoutRepository
from repositories.user import UserRepository
from schemas import PayoutRequest, PayoutResponse
from datetime import datetime

router = APIRouter(prefix="/payout")

# Simple payout WebSocket manager for broadcasting updates to connected users
class PayoutConnectionManager:
    def __init__(self):
        self._connections: dict[int, list[WebSocket]] = {}  # user_id -> [websockets]

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self._connections:
            self._connections[user_id].remove(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: str):
        if user_id in self._connections:
            for ws in list(self._connections[user_id]):
                try:
                    await ws.send_text(message)
                except Exception:
                    self._connections[user_id].remove(ws)

payout_manager = PayoutConnectionManager()


@router.post("/", response_model=PayoutResponse)
async def request_payout(
    data: PayoutRequest,
    user: User = Depends(get_current_user_or_by_api_key),
    session: AsyncSession = Depends(get_session),
):
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
        currency=payout.currency,
        card_holder=payout.card_holder,
        card_number=payout.card_number,
        phone_number=payout.phone_number,
        bank_name=payout.bank_name,
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
            receipt_url=p.receipt_url,
            status=p.status,
            created_at=p.created_at,
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

    if payout.status in ("completed", "cancelled"):
        raise HTTPException(status_code=409, detail="Cannot change status of completed or cancelled payout")

    old_status = payout.status
    payout.status = status

    if status == "completed" and old_status != "completed":
        user.balance += payout.amount
        history = BalanceHistory(
            user_id=user.id,
            action="payout_completed",
            amount=float(payout.amount),
            reason=f"Payout #{payout.id} completed ({payout.currency})",
            created_at=datetime.now(),
        )
        session.add(history)

    await session.commit()
    await session.refresh(payout)
    await session.refresh(user)

    # Broadcast status update to WebSocket clients
    await payout_manager.broadcast_to_user(
        user.id,
        json.dumps({
            "event": "payout_updated",
            "payout_id": payout.id,
            "status": payout.status,
        })
    )

    return PayoutResponse(
        id=payout.id,
        amount=float(payout.amount),
        wallet_address=payout.wallet_address,
        currency=payout.currency,
        card_holder=payout.card_holder,
        card_number=payout.card_number,
        phone_number=payout.phone_number,
        bank_name=payout.bank_name,
        receipt_url=payout.receipt_url,
        status=payout.status,
        created_at=payout.created_at,
    )


@router.websocket("/ws/payouts")
async def payouts_ws(websocket: WebSocket, token: str = Query()):
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[PAYOUT WS] Connection attempt, token={token[:20]}...")

    await websocket.accept()
    logger.info(f"[PAYOUT WS] Connection accepted")

    try:
        user_id = _decode_token(token)
        logger.info(f"[PAYOUT WS] Token decoded, user_id={user_id}")
        session = SessionLocal()
        user = await UserRepository(session).get_with_currencies(user_id)
        if not user:
            logger.info(f"[PAYOUT WS] User not found for id={user_id}")
            await websocket.close(code=1008, reason="User not found")
            return
    except HTTPException as e:
        logger.info(f"[PAYOUT WS] HTTPException: {e.detail}")
        await websocket.close(code=1008, reason="Invalid token")
        return
    except Exception as e:
        logger.error(f"[PAYOUT WS] Exception: {e}", exc_info=True)
        await websocket.close(code=1008, reason="Error")
        return

    logger.info(f"[PAYOUT WS] Connected for user {user.id}")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info(f"WebSocket /ws/payouts disconnected for user {user.id}")
        pass


@router.post("/{payout_id}/receipt/")
async def upload_payout_receipt(
    payout_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    from models import Payout
    from sqlalchemy import select

    # Verify payout belongs to user
    stmt = select(Payout).where(
        (Payout.id == payout_id) & (Payout.user_id == user.id)
    )
    result = await session.execute(stmt)
    payout = result.scalar_one_or_none()

    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    # Create uploads directory if it doesn't exist
    upload_dir = Path("/app/uploads/receipts")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save file
    file_path = upload_dir / f"payout_{payout_id}_{file.filename}"
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Save URL in database
    receipt_url = f"/uploads/receipts/payout_{payout_id}_{file.filename}"
    payout.receipt_url = receipt_url
    await session.commit()
    await session.refresh(payout)

    return {"url": receipt_url}

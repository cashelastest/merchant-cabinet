"""Deal router."""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import json

from sqlalchemy.ext.asyncio import AsyncSession
from core.ws_manager import manager
from core.dependencies import get_current_user, get_deal_service, redis_service, get_session, _decode_token, SessionLocal, get_user_by_api_key
from services.deal import DealService
from models import User, BalanceHistory
from schemas import DealCreateRequest, DealResponse
from repositories.user import UserRepository
from datetime import datetime

router = APIRouter()


@router.get("/deals", response_model=list[DealResponse])
async def list_deals(
    deal_id: Optional[int] = None,
    status: Optional[str] = None,
    from_xml: Optional[str] = None,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    deals = await service.list_deals(user, deal_id, status, from_xml)
    user_repo = UserRepository(session)
    result = []
    for deal in deals:
        deal_dict = {
            **deal.__dict__,
            "accepted_by_username": None,
        }
        if deal.accepted_by:
            accepted_user = await user_repo.get_by_id(deal.accepted_by)
            if accepted_user:
                deal_dict["accepted_by_username"] = accepted_user.username
        result.append(DealResponse(**deal_dict))
    return result


@router.post("/deal/")
async def create_deal(
    data: DealCreateRequest,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_user_by_api_key),
):
    deal = await service.create(data)

    deal_data = data.model_dump(mode="json")
    deal_data["id"] = deal.id
    deal_data["received_at"] = deal.received_at.isoformat() + "Z" if deal.received_at else None
    deal_data["accepted_by"] = None
    deal_data["accepted_at"] = None
    deal_data["updated_at"] = None

    ws_message = json.dumps({
        "event": "new_deal",
        "deal_id": deal.id,
        "from_xml": data.from_xml,
        "data": deal_data,
    })

    # Broadcast to matching merchants and all admins
    await manager.broadcast_to_matching(ws_message, data.from_xml)

    try:
        await redis_service.publish_deal(deal.id, deal_data, data.from_xml)
    except Exception:
        pass

    return {"id": deal.id}


@router.post("/deal/{deal_id}/accept")
async def accept_deal(
    deal_id: int,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    try:
        deal = await service.accept(deal_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=404 if str(e) == "not_found" else 409)
    return {"id": deal.id, "status": deal.status}


@router.post("/deal/{deal_id}/refuse")
async def refuse_deal(
    deal_id: int,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    try:
        deal = await service.refuse(deal_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=404 if str(e) == "not_found" else 409)
    return {"id": deal.id, "status": deal.status}


@router.post("/deal/{deal_id}/complete")
async def complete_deal(
    deal_id: int,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    try:
        deal = await service.complete(deal_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=404 if str(e) == "not_found" else 409)
    return {"id": deal.id, "status": deal.status}


@router.patch("/deal/{deal_id}/status")
async def update_deal_status(
    deal_id: int,
    status: str,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from models import Deal

    stmt = select(Deal).where(Deal.id == deal_id)
    result = await session.execute(stmt)
    deal = result.scalar_one_or_none()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    if deal.status in ("accepted", "refused"):
        raise HTTPException(
            status_code=409,
            detail="Cannot change status of completed or refused deal",
        )

    old_status = deal.status
    deal.status = status

    if status == "accepted" and old_status != "accepted":
        amount = deal.to_values.get("amount", 0) if deal.to_values else 0
        user.balance += float(amount)
        history = BalanceHistory(
            user_id=user.id,
            action="deal_accepted",
            amount=float(amount),
            reason=f"Deal #{deal.id} accepted ({deal.from_xml})",
            created_at=datetime.now(),
        )
        session.add(history)

    await session.commit()
    await session.refresh(deal)
    await session.refresh(user)

    return {"id": deal.id, "status": deal.status}


@router.websocket("/ws/deals")
async def deals_ws(websocket: WebSocket, token: str = Query()) -> None:
    await websocket.accept()

    try:
        user_id = _decode_token(token)
        session = SessionLocal()
        user = await UserRepository(session).get_with_currencies(user_id)
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return
    except HTTPException:
        await websocket.close(code=1008, reason="Invalid token")
        return

    xml_codes = {c.xml for c in user.currencies}
    await manager.connect(websocket, xml_codes, is_active=user.is_active, is_admin=user.is_admin)

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
                action = msg.get("action")
                if action in ("pause", "resume"):
                    manager.set_active(websocket, action == "resume")
                elif action == "update_currencies":
                    xml_codes = set(msg.get("currencies", []))
                    manager.update_xml_codes(websocket, xml_codes)
            except (ValueError, KeyError):
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

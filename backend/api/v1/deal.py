"""Deal router."""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from typing import Optional
import json

from core.ws_manager import manager
from core.dependencies import get_current_user, get_current_user_ws, get_deal_service, redis_service
from services.deal import DealService
from models import User
from schemas import DealCreateRequest, DealResponse

router = APIRouter()


@router.get("/deals", response_model=list[DealResponse])
async def list_deals(
    deal_id: Optional[int] = None,
    status: Optional[str] = None,
    from_xml: Optional[str] = None,
    service: DealService = Depends(get_deal_service),
    user: User = Depends(get_current_user),
):
    return await service.list_deals(user, deal_id, status, from_xml)


@router.post("/deal/")
async def create_deal(
    data: DealCreateRequest,
    service: DealService = Depends(get_deal_service),
    _: User = Depends(get_current_user),
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

    # Direct broadcast — надёжно, не зависит от Redis
    await manager.broadcast_to_matching(ws_message, data.from_xml)

    # Redis — для внешних систем / multi-instance (игнорируем ошибки)
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


@router.websocket("/ws/deals")
async def deals_ws(
    websocket: WebSocket,
    user: User = Depends(get_current_user_ws),
) -> None:
    xml_codes = {c.xml for c in user.currencies}
    await manager.connect(websocket, xml_codes, is_active=user.is_active)

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

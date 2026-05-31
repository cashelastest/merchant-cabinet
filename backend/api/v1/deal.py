"""Deal router."""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from core.ws_manager import manager
from core.dependencies import get_current_user, get_current_user_ws, get_deal_service, redis_service
from services.deal import DealService
from models import User
from schemas import DealCreateRequest

router = APIRouter()


@router.post("/deal/")
async def create_deal(
    data: DealCreateRequest,
    service: DealService = Depends(get_deal_service),
    _: User = Depends(get_current_user),
):
    deal = await service.create(data)
    await redis_service.publish_deal(deal.id, data.model_dump(mode="json"), data.from_xml)
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


@router.websocket("/ws/deals")
async def deals_ws(
    websocket: WebSocket,
    user: User = Depends(get_current_user_ws),
) -> None:
    xml_codes = {c.xml for c in user.currencies}
    await manager.connect(websocket, xml_codes)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

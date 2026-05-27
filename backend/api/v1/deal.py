"""Deal router."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from core.ws_manager import manager

router = APIRouter()

@router.post("/deal/")
async def create_deal()

@router.websocket("/ws/deals")
async def deals_ws(websocket: WebSocket) -> None:
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()  # держим соединение открытым
    except WebSocketDisconnect:
        manager.disconnect(websocket)
"""WebSocket connection manager."""

from fastapi import WebSocket
from dataclasses import dataclass, field


@dataclass
class WsSession:
    xml_codes: set[str]
    is_active: bool = True
    is_admin: bool = False


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: dict[WebSocket, WsSession] = {}

    async def connect(self, ws: WebSocket, xml_codes: set[str], is_active: bool = True, is_admin: bool = False) -> None:
        await ws.accept()
        self._connections[ws] = WsSession(xml_codes=xml_codes, is_active=is_active, is_admin=is_admin)

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.pop(ws, None)

    def set_active(self, ws: WebSocket, is_active: bool) -> None:
        if ws in self._connections:
            self._connections[ws].is_active = is_active

    def update_xml_codes(self, ws: WebSocket, xml_codes: set[str]) -> None:
        if ws in self._connections:
            self._connections[ws].xml_codes = xml_codes

    async def broadcast_to_matching(self, message: str, from_xml: str) -> None:
        for ws, session in list(self._connections.items()):
            # Send to active merchants with matching currency OR to all admins
            if session.is_admin or (session.is_active and from_xml in session.xml_codes):
                try:
                    await ws.send_text(message)
                except Exception:
                    self._connections.pop(ws, None)

    async def broadcast_to_all_active(self, message: str) -> None:
        for ws, session in list(self._connections.items()):
            if session.is_active:
                try:
                    await ws.send_text(message)
                except Exception:
                    self._connections.pop(ws, None)


manager = ConnectionManager()

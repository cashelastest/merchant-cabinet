"""WebSocket connection manager."""

from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: dict[WebSocket, set[str]] = {}

    async def connect(self, ws: WebSocket, xml_codes: set[str]) -> None:
        await ws.accept()
        self._connections[ws] = xml_codes

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.pop(ws, None)

    async def broadcast_to_matching(self, message: str, from_xml: str) -> None:
        for ws, xml_codes in self._connections.items():
            if from_xml in xml_codes:
                await ws.send_text(message)


manager = ConnectionManager()

"""WebSocket connection manager."""

from fastapi import WebSocket
from dataclasses import dataclass
from typing import Callable


@dataclass
class WsSession:
    xml_codes: set[str]
    is_active: bool = True
    is_admin: bool = False
    user_id: int | None = None


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: dict[WebSocket, WsSession] = {}

    async def connect(
        self,
        ws: WebSocket,
        xml_codes: set[str],
        is_active: bool = True,
        is_admin: bool = False,
        user_id: int | None = None,
    ) -> None:
        await ws.accept()
        self._connections[ws] = WsSession(
            xml_codes=xml_codes, is_active=is_active, is_admin=is_admin, user_id=user_id
        )

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.pop(ws, None)

    async def disconnect_user(self, user_id: int) -> None:
        """Closes every socket of one user, e.g. right after they are banned."""
        for ws, session in list(self._connections.items()):
            if session.user_id == user_id:
                self._connections.pop(ws, None)
                try:
                    await ws.close(code=1008, reason="User is banned")
                except Exception:
                    pass

    def set_active(self, ws: WebSocket, is_active: bool) -> None:
        if ws in self._connections:
            self._connections[ws].is_active = is_active

    def update_user_xml_codes(self, user_id: int, xml_codes: set[str]) -> None:
        """Applies a changed currency list to every live socket of one user.

        A socket captures the list when it connects, so without this a merchant
        keeps missing deals for a newly assigned currency until they reload.
        """
        for session in self._connections.values():
            if session.user_id == user_id:
                session.xml_codes = set(xml_codes)

    @staticmethod
    def _matches(session: WsSession, payout_xml: str) -> bool:
        # Active merchants paying out in this currency, or any admin
        return session.is_admin or (session.is_active and payout_xml in session.xml_codes)

    async def broadcast_to_matching(self, message: str, payout_xml: str) -> None:
        for ws, session in list(self._connections.items()):
            if self._matches(session, payout_xml):
                try:
                    await ws.send_text(message)
                except Exception:
                    self._connections.pop(ws, None)

    async def broadcast_to_matching_each(
        self, payout_xml: str, render: Callable[[WsSession], str]
    ) -> None:
        """Like broadcast_to_matching, but builds the message per recipient.

        For payloads that differ between merchants — each one sees the rate with
        their own markup applied.
        """
        for ws, session in list(self._connections.items()):
            if self._matches(session, payout_xml):
                try:
                    await ws.send_text(render(session))
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

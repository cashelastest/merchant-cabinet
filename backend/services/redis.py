"""Redis service."""

import json
from redis.asyncio import Redis
from core.ws_manager import manager


class RedisService:
    """Redis pub/sub service."""

    def __init__(self, client: Redis) -> None:
        self._client = client

    async def publish_deal(self, deal_id: int, data: dict, from_xml: str) -> None:
        await self._client.publish("deals", json.dumps({
            "event": "new_deal",
            "deal_id": deal_id,
            "from_xml": from_xml,
            "data": data
        }))

    async def listen(self) -> None:
        pubsub = self._client.pubsub()
        await pubsub.subscribe("deals")

        async for message in pubsub.listen():
            if message["type"] == "message":
                payload = json.loads(message["data"])
                await manager.broadcast_to_matching(message["data"], payload["from_xml"])

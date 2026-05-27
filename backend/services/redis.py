"""Redis service."""

import json
from redis.asyncio import Redis
from core.ws_manager import manager


class RedisService:
    """Redis pub/sub service."""

    def __init__(self, client: Redis) -> None:
        self._client = client

    async def publish_deal(self, deal_id: int, data: dict) -> None:
        await self._client.publish("deals", json.dumps({
            "event": "new_deal",
            "deal_id": deal_id,
            "data": data
        }))

    async def listen(self) -> None:
        pubsub = self._client.pubsub()
        await pubsub.subscribe("deals")

        async for message in pubsub.listen():
            if message["type"] == "message":
                await manager.broadcast(message["data"])

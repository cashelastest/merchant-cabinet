"""Redis service."""

import asyncio
import json
import logging

from redis.asyncio import Redis
from core.ws_manager import manager

logger = logging.getLogger("merchant")


class RedisService:
    """Redis pub/sub service."""

    def __init__(self, client: Redis) -> None:
        self._client = client

    async def publish_deal(self, deal_id: int, data: dict, payout_xml: str) -> None:
        await self._client.publish("deals", json.dumps({
            "event": "new_deal",
            "deal_id": deal_id,
            "payout_xml": payout_xml,
            "data": data,
        }))

    async def listen(self) -> None:
        """Listen to Redis pub/sub for multi-instance broadcasting.
        Direct WS broadcast is handled in the deal router for single-instance reliability.
        """
        while True:
            try:
                pubsub = self._client.pubsub()
                await pubsub.subscribe("deals")
                logger.info("Redis listener ready")
                async for message in pubsub.listen():
                    if message["type"] != "message":
                        continue
                    try:
                        payload = json.loads(message["data"])
                        # Only broadcast here for messages from OTHER instances
                        # (direct broadcast already handles the local instance)
                    except Exception as e:
                        logger.warning(f"Redis message parse error: {e}")
            except Exception as e:
                logger.error(f"Redis listener error: {e}, retrying in 2s")
                await asyncio.sleep(2)

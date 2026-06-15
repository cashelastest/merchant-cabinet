import time
import json
import hashlib
import httpx
from decimal import Decimal
from fastapi import HTTPException

from core.config import BIZON_PUBLIC_URL
from .exchanger_api import ExchangerAPI

BIZON_USER_URL  = "https://www.exchange-bizon.com/service/api/v1/user"
BIZON_BASE_URL  = "https://www.exchange-bizon.com/service/api/v1"


class BizonService:

    @staticmethod
    def _make_headers(api_key: str, secret: str, params: dict) -> dict:
        params_json = json.dumps(params, separators=(',', ':'), sort_keys=True)
        checksum = hashlib.sha256(params_json.encode()).hexdigest()
        final_hash = hashlib.sha256((checksum + secret).encode()).hexdigest()
        return {
            'Content-Type': 'application/json',
            'apiKey': api_key,
            'hash': final_hash,
        }

    @classmethod
    async def _post(cls, url: str, headers: dict, params: dict) -> dict:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.post(url, headers=headers, json=params)
            response.raise_for_status()
            data = response.json()
            if not data.get("success"):
                msg = data.get("error", {}).get("message", "Unknown error")
                raise HTTPException(status_code=502, detail=f"Bizon API error: {msg}")
            return data

    @classmethod
    async def get_wallets_balance(cls, api_key: str, secret: str) -> dict:
        params = {"time": int(time.time() * 1000)}
        headers = cls._make_headers(api_key, secret, params)
        return await cls._post(f"{BIZON_USER_URL}/wallets/balance", headers, params)

    @classmethod
    async def get_routes(cls) -> list:
        url = f"{BIZON_PUBLIC_URL}/route/get/"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers={}, json={})
            response.raise_for_status()
            data = response.json()
            return data.get("routes", []) if data.get("success") else []

    @classmethod
    async def find_payout_route(cls) -> str | None:
        routes = await cls.get_routes()
        for route in routes:
            if (
                not route.get("isShowWeb")
                and route.get("from", {}).get("xml") == "USDT"
                and route.get("to", {}).get("xml") == "USDT_wallet"
            ):
                return route.get("routeId")
        return None

    @classmethod
    async def update_order_status(cls, api_key: str, secret: str, order_id: int, status: str) -> dict:
        api = ExchangerAPI(api_url=BIZON_BASE_URL, api_key=api_key, api_secret=secret)
        return await api.call("PUT:/admin/exchanger/order/update-status", {
            "post": {"orderId": order_id, "status": status}
        })

    @classmethod
    async def create_order(
        cls,
        api_key: str,
        secret: str,
        route_id: str,
        amount: Decimal,
        wallet_address: str,
    ) -> dict:
        api = ExchangerAPI(
            api_url=BIZON_PUBLIC_URL,
            api_key=api_key,
            api_secret=secret,
        )
        return await api.call("/order/create/", {
            "post": {
                "routeId": route_id,
                "amount": str(amount),
                "toValues": [{"key": "walletAddress", "value": wallet_address}],
                "agreement": True,
                "skipPreview": True,
                "typeClient": "api",
                "hideOutData": True,
            }
        })

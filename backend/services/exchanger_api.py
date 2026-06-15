import time
import json
import hashlib
import httpx


class ExchangerAPI:
    def __init__(self, api_url: str, api_key: str, api_secret: str):
        self.config = {"apiUrl": api_url, "apikey": api_key, "secret": api_secret}

    def _generate_hash(self, get_params: dict, post_params: dict) -> str:
        get_str = {k: [str(v) for v in val] if isinstance(val, list) else str(val) for k, val in get_params.items()}
        params = {**get_str, **post_params}
        checksum = hashlib.sha256(
            json.dumps(params, separators=(',', ':'), ensure_ascii=False).encode()
        ).hexdigest()
        return hashlib.sha256((checksum + self.config["secret"]).encode()).hexdigest()

    async def call(self, method: str, param: dict | None = None) -> dict:
        if param is None:
            param = {}
        get: dict = param.get("get", {})
        post: dict = param.get("post", {})

        parts = method.split(":")
        type_method, path = ("POST", parts[0]) if len(parts) == 1 else (parts[0].upper(), parts[1])

        get["time"] = int(time.time() * 1000)
        query = "&".join(
            f"{k}={v}" if not isinstance(v, list) else "&".join(f"{k}[]={i}" for i in v)
            for k, v in get.items()
        )
        url = f"{self.config['apiUrl']}{path}?{query}"
        headers = {
            "content-type": "application/json",
            "cache-control": "no-cache",
            "apikey": self.config["apikey"],
            "hash": self._generate_hash(get, post),
        }
        import sys
        print(f"[ExchangerAPI] {type_method} {url} body={post}", file=sys.stderr, flush=True)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(type_method, url, headers=headers, json=post or None)
            response.raise_for_status()
            body = response.json()
            print(f"[ExchangerAPI] response={body}", file=sys.stderr, flush=True)
            if body.get("success") and body.get("data") is not None:
                return body["data"]
            if body.get("result") is not None:
                return body["result"]
            raise RuntimeError(f"Bizon API error: {body.get('error', {})}")

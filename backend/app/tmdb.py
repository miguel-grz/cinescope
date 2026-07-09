"""Async TMDB client with in-memory TTL caching.

All upstream calls go through `get()`, which caches by (path, sorted params)
so repeated requests within the TTL never hit TMDB — this keeps us far away
from TMDB rate limits and makes the UI feel instant.
"""
import asyncio
from typing import Any, Dict, Optional

import httpx
from cachetools import TTLCache
from fastapi import HTTPException

from .config import settings

_cache: TTLCache = TTLCache(maxsize=settings.cache_max_size, ttl=settings.cache_ttl_seconds)
_cache_lock = asyncio.Lock()

_client: Optional[httpx.AsyncClient] = None


async def open_client() -> None:
    global _client
    _client = httpx.AsyncClient(
        base_url=settings.tmdb_base_url,
        params={"api_key": settings.tmdb_api_key},
        timeout=15.0,
    )


async def close_client() -> None:
    if _client is not None:
        await _client.aclose()


def _cache_key(path: str, params: Dict[str, Any]) -> str:
    return path + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))


async def get(path: str, **params: Any) -> Dict[str, Any]:
    """GET a TMDB endpoint, serving from cache when fresh."""
    clean = {k: v for k, v in params.items() if v is not None}
    key = _cache_key(path, clean)

    async with _cache_lock:
        if key in _cache:
            return _cache[key]

    assert _client is not None, "TMDB client not initialized"
    try:
        response = await _client.get(path, params=clean)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"TMDB unreachable: {exc}") from exc

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Not found on TMDB")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"TMDB error {response.status_code}")

    data = response.json()
    async with _cache_lock:
        _cache[key] = data
    return data

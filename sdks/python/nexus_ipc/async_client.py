from __future__ import annotations

import asyncio
import urllib.parse
from collections.abc import AsyncIterator
from typing import Any

from .client import NexusClient


class AsyncNexusClient:
    def __init__(self, client: NexusClient):
        self._client = client

    @classmethod
    async def connect(cls, base_url: str | None = None, token: str | None = None) -> "AsyncNexusClient":
        return cls(NexusClient.connect(base_url=base_url, token=token))

    async def register_agent(self, *args: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(self._client.register_agent, *args, **kwargs)

    async def publish_delta(self, *args: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(self._client.publish_delta, *args, **kwargs)

    async def checkpoint(self, *args: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(self._client.checkpoint, *args, **kwargs)

    async def replay(self, *args: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(self._client.replay, *args, **kwargs)

    async def diff(self, *args: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(self._client.diff, *args, **kwargs)

    async def fork(self, *args: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(self._client.fork, *args, **kwargs)

    async def subscribe(self, channel: str, poll_interval: float = 1.0) -> AsyncIterator[dict[str, Any]]:
        seen: set[str] = set()
        encoded = urllib.parse.quote(channel, safe="")
        while True:
            updates = await asyncio.to_thread(
                self._client._get,
                f"/api/channels/{encoded}/deltas",
            )
            for update in updates:
                delta_id = update.get("delta_id") or update.get("deltaId")
                if delta_id not in seen:
                    seen.add(delta_id)
                    yield update
            await asyncio.sleep(poll_interval)

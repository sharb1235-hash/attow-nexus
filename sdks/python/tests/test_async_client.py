import pytest

from nexus_ipc.async_client import AsyncNexusClient
from nexus_ipc.testing import FakeNexusClient


@pytest.mark.asyncio
async def test_async_client_register_agent() -> None:
    client = AsyncNexusClient(FakeNexusClient())  # type: ignore[arg-type]
    result = await client.register_agent(agent_id="a", run_id="r")
    assert result["accepted"] is True


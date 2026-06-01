from nexus_ipc.adapters.generic import NexusAgentAdapter
from nexus_ipc.testing import FakeNexusClient


def test_generic_adapter_wraps_step() -> None:
    client = FakeNexusClient()
    adapter = NexusAgentAdapter(client, "a", "r", "topic:x")  # type: ignore[arg-type]

    def step(state: dict[str, int]) -> dict[str, int]:
        return {"x": state["x"] + 1}

    wrapped = adapter.wrap_step(step)
    assert wrapped({"x": 1}) == {"x": 2}
    assert client.events[-1]["type"] == "checkpoint"


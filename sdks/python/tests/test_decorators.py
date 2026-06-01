from nexus_ipc.decorators import nexus_checkpoint
from nexus_ipc.testing import FakeNexusClient


def test_checkpoint_decorator_records_result() -> None:
    client = FakeNexusClient()

    @nexus_checkpoint(agent_id="a", run_id="r", channel="topic:x", client=client)  # type: ignore[arg-type]
    def step() -> dict[str, int]:
        return {"x": 1}

    assert step() == {"x": 1}
    assert client.events[-1]["type"] == "checkpoint"


from nexus_ipc.adapters.langgraph import wrap_node
from nexus_ipc.testing import FakeNexusClient


def test_langgraph_wrapper_records_public_node_transition() -> None:
    client = FakeNexusClient()

    def node(state: dict[str, int]) -> dict[str, int]:
        return {"x": state["x"] + 1}

    wrapped = wrap_node(client, "a", "r", "plan", node)  # type: ignore[arg-type]
    assert wrapped({"x": 1}) == {"x": 2}
    assert client.events[-1]["type"] == "checkpoint"


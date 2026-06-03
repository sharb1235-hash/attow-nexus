from typing import Any

from nexus_ipc.client import NexusClient
from nexus_ipc.models import CheckpointRequest, PublishDelta
from nexus_ipc.testing import FakeNexusClient


def test_client_connects_with_fake() -> None:
    client = FakeNexusClient()
    result = client.register_agent(agent_id="researcher", run_id="run-1", capabilities=[])
    assert result["accepted"] is True


def test_publish_model_validation() -> None:
    model = PublishDelta(
        channel="topic:research",
        agent_id="a",
        run_id="r",
        delta={"x": 1},
    )
    assert model.channel == "topic:research"


def test_checkpoint_returns_commit_id() -> None:
    client = FakeNexusClient()
    commit = client.checkpoint(agent_id="a", run_id="r", channel="topic:x", state={"x": 1})
    assert commit.commit_id == "c_fake"


def test_checkpoint_model_validation() -> None:
    model = CheckpointRequest(
        agent_id="a",
        run_id="r",
        channel="topic:x",
        state={"x": 1},
        parent_commit_ids=["c_parent"],
    )
    assert model.state == {"x": 1}
    assert model.parent_commit_ids == ["c_parent"]


def test_client_sends_bearer_token(monkeypatch: Any) -> None:
    captured: dict[str, str] = {}

    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
            return None

        def read(self) -> bytes:
            return b'{"status":"ok"}'

    def fake_urlopen(request: Any, timeout: int) -> FakeResponse:
        captured["authorization"] = request.get_header("Authorization")
        return FakeResponse()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    NexusClient(token="audit-token")._get("/api/health")
    assert captured["authorization"] == "Bearer audit-token"

from __future__ import annotations

import asyncio

import pytest

from nexus_ipc.adapters.crewai import NexusCrewAIProxy, instrument_crewai
from nexus_ipc.models import CommitResult


class RecordingNexusClient:
    def __init__(self) -> None:
        self.events: list[dict[str, object]] = []
        self.count = 0

    def register_agent(self, **kwargs: object) -> dict[str, object]:
        self.events.append({"type": "register_agent", **kwargs})
        return {"accepted": True}

    def checkpoint(self, **kwargs: object) -> CommitResult:
        self.count += 1
        commit_id = f"c_{self.count}"
        self.events.append({"type": "checkpoint", "commit_id": commit_id, **kwargs})
        return CommitResult.model_validate(
            {"deltaId": f"delta_{self.count}", "commitId": commit_id, "accepted": True, "persisted": True}
        )


class FakeCrew:
    description = "fake crew"

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.step_calls = 0
        self.step_callback = self._step_callback

    def _step_callback(self, *args: object, **kwargs: object) -> None:
        self.step_calls += 1

    def kickoff(self, **kwargs: object) -> dict[str, object]:
        if callable(self.step_callback):
            self.step_callback({"task": "research"})
        if self.fail:
            raise RuntimeError("crew failed")
        return {"result": kwargs.get("topic", "ok")}

    async def kickoff_async(self, **kwargs: object) -> dict[str, object]:
        return {"async_result": kwargs.get("topic", "ok")}


def checkpoints(client: RecordingNexusClient) -> list[dict[str, object]]:
    return [event for event in client.events if event["type"] == "checkpoint"]


def test_instrument_crewai_returns_proxy_and_delegates_attributes() -> None:
    crew = FakeCrew()
    proxy = instrument_crewai(crew, client=RecordingNexusClient(), run_id="run-1")

    assert isinstance(proxy, NexusCrewAIProxy)
    assert proxy.description == "fake crew"
    assert proxy.wrapped_crew is crew


def test_kickoff_pass_through_and_checkpoints_start_step_end() -> None:
    client = RecordingNexusClient()
    crew = FakeCrew()
    proxy = instrument_crewai(crew, client=client, run_id="run-1", agent_id="crew")

    result = proxy.kickoff(topic="local-state")

    assert result == {"result": "local-state"}
    assert crew.step_calls == 1
    commits = checkpoints(client)
    assert [commit["state"]["event_type"] for commit in commits] == [  # type: ignore[index]
        "run_start",
        "task_end",
        "run_end",
    ]
    assert commits[0]["channel"] == "framework:crewai:run-1"
    assert commits[-1]["parent_commit_ids"] == ["c_2"]


def test_existing_step_callback_is_preserved() -> None:
    client = RecordingNexusClient()
    crew = FakeCrew()
    proxy = instrument_crewai(crew, client=client, run_id="run-1")

    proxy.kickoff()

    assert crew.step_calls == 1
    assert any(commit["state"]["event_type"] == "task_end" for commit in checkpoints(client))  # type: ignore[index]


def test_errors_are_checkpointed_and_reraised() -> None:
    client = RecordingNexusClient()
    proxy = instrument_crewai(FakeCrew(fail=True), client=client, run_id="run-1")

    with pytest.raises(RuntimeError, match="crew failed"):
        proxy.kickoff()

    assert checkpoints(client)[-1]["state"]["event_type"] == "error"  # type: ignore[index]
    assert checkpoints(client)[-1]["state"]["error"]["type"] == "RuntimeError"  # type: ignore[index]


def test_kickoff_async_pass_through() -> None:
    client = RecordingNexusClient()
    proxy = instrument_crewai(FakeCrew(), client=client, run_id="run-1")

    result = asyncio.run(proxy.kickoff_async(topic="async"))

    assert result == {"async_result": "async"}
    assert [commit["state"]["event_type"] for commit in checkpoints(client)] == ["run_start", "run_end"]  # type: ignore[index]

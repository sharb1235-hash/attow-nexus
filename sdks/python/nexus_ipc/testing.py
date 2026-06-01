from __future__ import annotations

from typing import Any

from .models import CommitResult, DeltaResult, ForkResult


class FakeNexusClient:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    def register_agent(self, **kwargs: Any) -> dict[str, Any]:
        self.events.append({"type": "register_agent", **kwargs})
        return {"accepted": True, "agentId": kwargs.get("agent_id"), "protocolVersion": "nexus.v1"}

    def publish_delta(self, **kwargs: Any) -> DeltaResult:
        self.events.append({"type": "publish_delta", **kwargs})
        return DeltaResult.model_validate(
            {"deltaId": "delta_fake", "commitId": "", "accepted": True, "persisted": False}
        )

    def checkpoint(self, **kwargs: Any) -> CommitResult:
        self.events.append({"type": "checkpoint", **kwargs})
        return CommitResult.model_validate(
            {"deltaId": "delta_fake", "commitId": "c_fake", "accepted": True, "persisted": True}
        )

    def fork(self, commit_id: str, new_run_id: str | None = None) -> ForkResult:
        return ForkResult.model_validate(
            {"sourceCommitId": commit_id, "runId": new_run_id or "run_fake", "headCommitId": commit_id}
        )


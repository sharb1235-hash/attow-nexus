from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterator
from typing import Any

from .errors import NexusConnectionError
from .models import (
    AgentRegistration,
    CheckpointRequest,
    CommitResult,
    DeltaResult,
    ForkResult,
    PublishDelta,
    RunContext,
)
from .redaction import redact


class NexusClient:
    def __init__(self, base_url: str = "http://127.0.0.1:7822", token: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    @classmethod
    def connect(cls, base_url: str | None = None, token: str | None = None) -> "NexusClient":
        return cls(
            base_url=base_url or os.getenv("NEXUS_HTTP_URL", "http://127.0.0.1:7822"),
            token=token or os.getenv("NEXUS_AUTH_TOKEN"),
        )

    def run(self, objective: str | None = None, run_id: str | None = None) -> RunContext:
        return RunContext(self, objective=objective, run_id=run_id)

    def register_agent(
        self,
        agent_id: str,
        run_id: str,
        capabilities: list[str] | None = None,
        framework: str = "custom",
        thread_id: str | None = None,
        metadata: dict[str, str] | None = None,
        language: str = "python",
    ) -> dict[str, Any]:
        body = AgentRegistration(
            agent_id=agent_id,
            run_id=run_id,
            thread_id=thread_id,
            framework=framework,
            language=language,
            capabilities=capabilities or [],
            metadata=metadata or {},
        ).model_dump()
        return self._post("/api/agents/register", body)

    def publish_delta(
        self,
        channel: str,
        delta: dict[str, Any],
        durable: bool = False,
        agent_id: str = "python-agent",
        run_id: str = "python-run",
        thread_id: str | None = None,
        summary: str | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, str] | None = None,
    ) -> DeltaResult:
        clean_delta, _ = redact(delta)
        request = PublishDelta(
            channel=channel,
            delta=clean_delta,
            durable=durable,
            agent_id=agent_id,
            run_id=run_id,
            thread_id=thread_id,
            summary=summary,
            tags=tags or [],
            metadata=metadata or {},
        )
        response = self._post("/api/deltas", request.model_dump())
        return DeltaResult.model_validate(response)

    def subscribe(self, channel: str, poll_interval: float = 1.0) -> Iterator[dict[str, Any]]:
        seen: set[str] = set()
        encoded = urllib.parse.quote(channel, safe="")
        while True:
            updates = self._get(f"/api/channels/{encoded}/deltas")
            for update in updates:
                delta_id = update.get("delta_id") or update.get("deltaId")
                if delta_id not in seen:
                    seen.add(delta_id)
                    yield update
            time.sleep(poll_interval)

    def checkpoint(
        self,
        agent_id: str,
        run_id: str,
        channel: str,
        state: dict[str, Any],
        thread_id: str | None = None,
        summary: str | None = None,
        tags: list[str] | None = None,
        objective: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> CommitResult:
        clean_state, _ = redact(state)
        request = CheckpointRequest(
            agent_id=agent_id,
            run_id=run_id,
            channel=channel,
            state=clean_state,
            thread_id=thread_id,
            summary=summary,
            tags=tags or [],
            objective=objective,
            metadata=metadata or {},
        )
        response = self._post("/api/checkpoint", request.model_dump())
        return CommitResult.model_validate(response)

    def replay(self, commit_id: str, mode: str = "state_only") -> dict[str, Any]:
        return self._post("/api/replay", {"commit_id": commit_id, "mode": mode})

    def diff(self, commit_a: str, commit_b: str) -> dict[str, Any]:
        return self._get(f"/api/diff?from={commit_a}&to={commit_b}")

    def fork(self, commit_id: str, new_run_id: str | None = None) -> ForkResult:
        response = self._post(
            "/api/fork",
            {"source_commit_id": commit_id, "new_run_id": new_run_id or ""},
        )
        return ForkResult.model_validate(response)

    def rollback(self, head_commit_id: str, target_commit_id: str, force: bool = False) -> dict[str, Any]:
        return self._post(
            "/api/rollback",
            {
                "head_commit_id": head_commit_id,
                "target_commit_id": target_commit_id,
                "force": force,
            },
        )

    def record_side_effect(
        self,
        agent_id: str,
        run_id: str,
        channel: str,
        state: dict[str, Any],
        kind: str,
        description: str,
        target: str = "",
    ) -> CommitResult:
        clean_state, _ = redact(state)
        response = self._post(
            "/api/checkpoint",
            {
                "agent_id": agent_id,
                "run_id": run_id,
                "channel": channel,
                "state": clean_state,
                "summary": f"Recorded external side effect: {kind}",
                "external_side_effects": [
                    {
                        "kind": kind,
                        "description": description,
                        "target": target,
                        "reversible": False,
                        "compensating_action_available": False,
                    }
                ],
            },
        )
        return CommitResult.model_validate(response)

    def _get(self, path: str) -> Any:
        return self._request("GET", path)

    def _post(self, path: str, body: dict[str, Any]) -> Any:
        return self._request("POST", path, body)

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        if self.token:
            request.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                payload = response.read()
        except urllib.error.URLError as exc:
            raise NexusConnectionError(str(exc)) from exc
        return json.loads(payload.decode("utf-8")) if payload else None


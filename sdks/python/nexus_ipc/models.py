from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

CHANNEL_RE = re.compile(r"^[a-z][a-z0-9_]*:[A-Za-z0-9_.:\-*]+$")
ID_RE = re.compile(r"^[A-Za-z0-9_.:\-]+$")


class AgentRegistration(BaseModel):
    agent_id: str
    run_id: str
    thread_id: str | None = None
    framework: str = "custom"
    language: str = "python"
    capabilities: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)

    @field_validator("agent_id", "run_id")
    @classmethod
    def valid_id(cls, value: str) -> str:
        if not value or not ID_RE.match(value):
            raise ValueError("IDs must contain letters, numbers, underscore, dash, dot, or colon")
        return value


class PublishDelta(BaseModel):
    channel: str
    agent_id: str
    run_id: str
    delta: dict[str, Any]
    durable: bool = False
    thread_id: str | None = None
    summary: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)

    @field_validator("channel")
    @classmethod
    def valid_channel(cls, value: str) -> str:
        if not CHANNEL_RE.match(value):
            raise ValueError("channel must look like topic:name, run:id, agent:id, or similar")
        return value


class CheckpointRequest(BaseModel):
    agent_id: str
    run_id: str
    channel: str
    state: dict[str, Any]
    thread_id: str | None = None
    summary: str | None = None
    tags: list[str] = Field(default_factory=list)
    objective: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)

    @field_validator("channel")
    @classmethod
    def valid_channel(cls, value: str) -> str:
        if not CHANNEL_RE.match(value):
            raise ValueError("channel must look like topic:name, run:id, agent:id, or similar")
        return value


class DeltaResult(BaseModel):
    delta_id: str = Field(alias="deltaId")
    commit_id: str = Field(default="", alias="commitId")
    accepted: bool
    persisted: bool
    warning: str = ""
    redacted: bool = False


class CommitResult(DeltaResult):
    @property
    def id(self) -> str:
        return self.commit_id


class ForkResult(BaseModel):
    source_commit_id: str = Field(alias="sourceCommitId")
    run_id: str = Field(alias="runId")
    head_commit_id: str = Field(alias="headCommitId")


class RunContext:
    def __init__(self, client: Any, objective: str | None = None, run_id: str | None = None):
        self.client = client
        self.objective = objective
        self.run_id = run_id or "nexus-run"

    def __enter__(self) -> "RunContext":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    def register_agent(self, agent_id: str, capabilities: list[str] | None = None, **kwargs: Any) -> Any:
        return self.client.register_agent(
            agent_id=agent_id,
            run_id=self.run_id,
            capabilities=capabilities or [],
            **kwargs,
        )

    def publish_delta(self, channel: str, delta: dict[str, Any], durable: bool = False, **kwargs: Any) -> Any:
        return self.client.publish_delta(
            channel=channel,
            delta=delta,
            durable=durable,
            run_id=self.run_id,
            **kwargs,
        )


from __future__ import annotations

import inspect
import json
import re
import time
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field
from pydantic import field_validator

from .redaction import redact

CHANNEL_RE = re.compile(r"^[a-z][a-z0-9_]*:[A-Za-z0-9_.:\-*]+$")
ID_RE = re.compile(r"^[A-Za-z0-9_.:\-]+$")
ALLOWED_FRAMEWORKS = {
    "autogen",
    "crewai",
    "custom",
    "generic",
    "langgraph",
    "microsoft-agent-framework",
    "vercel-ai",
}

UniversalEventType = Literal[
    "run_start",
    "run_end",
    "step_start",
    "step_end",
    "node_start",
    "node_end",
    "task_start",
    "task_end",
    "tool_start",
    "tool_end",
    "stream_delta",
    "message_delta",
    "state_checkpoint",
    "error",
    "custom",
]


class UniversalAgentEvent(BaseModel):
    schema_version: str = "nexus.universal.v1"
    sdk_name: str = "nexus-ipc"
    sdk_version: str = "0.1.0"
    adapter_name: str = "generic"
    adapter_version: str = "0.1.0"
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex}")
    run_id: str
    thread_id: str
    agent_id: str
    framework: str
    framework_version: str | None = None
    language: str = "python"
    event_type: UniversalEventType
    channel: str = ""
    step_name: str | None = None
    node_name: str | None = None
    task_name: str | None = None
    tool_name: str | None = None
    input: Any | None = None
    output: Any | None = None
    delta: Any | None = None
    messages: list[Any] | None = None
    error: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    parent_commit_ids: list[str] = Field(default_factory=list)
    timestamp_ms: int = Field(default_factory=lambda: int(time.time() * 1000))

    @field_validator("schema_version")
    @classmethod
    def valid_schema_version(cls, value: str) -> str:
        if value != "nexus.universal.v1":
            raise ValueError("UniversalAgentEvent.schema_version must be nexus.universal.v1")
        return value

    @field_validator("run_id", "thread_id", "agent_id", "event_id")
    @classmethod
    def required_id(cls, value: str, info: Any) -> str:
        if not value:
            raise ValueError(f"UniversalAgentEvent.{info.field_name} is required")
        if not ID_RE.match(value):
            raise ValueError(f"UniversalAgentEvent.{info.field_name} contains invalid characters")
        return value

    @field_validator("framework")
    @classmethod
    def valid_framework(cls, value: str) -> str:
        if value not in ALLOWED_FRAMEWORKS:
            raise ValueError(
                "UniversalAgentEvent.framework must be one of "
                + ", ".join(sorted(ALLOWED_FRAMEWORKS))
            )
        return value

    @field_validator("channel")
    @classmethod
    def valid_channel(cls, value: str) -> str:
        if value and not CHANNEL_RE.match(value):
            raise ValueError("channel must match allowed Nexus channel pattern")
        return value

    @field_validator("parent_commit_ids", mode="before")
    @classmethod
    def valid_parent_commit_ids(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
            raise ValueError("parent_commit_ids must be an array of commit ID strings")
        return value

    @field_validator("timestamp_ms", mode="before")
    @classmethod
    def valid_timestamp_ms(cls, value: Any) -> int:
        if not isinstance(value, int):
            raise ValueError("timestamp_ms must be an integer Unix timestamp in milliseconds")
        if value <= 0:
            raise ValueError("timestamp_ms must be an integer Unix timestamp in milliseconds")
        return value


def default_thread_id(run_id: str, framework: str) -> str:
    return f"{run_id}:main:{framework}"


def channel_for_event(event: UniversalAgentEvent | dict[str, Any]) -> str:
    data = event.model_dump() if isinstance(event, UniversalAgentEvent) else event
    if data.get("channel"):
        return str(data["channel"])
    event_type = str(data.get("event_type", "custom"))
    run_id = str(data["run_id"])
    thread_id = str(data["thread_id"])
    framework = str(data["framework"])
    tool_name = data.get("tool_name")
    if tool_name:
        return f"tool:{run_id}:{tool_name}"
    if event_type in {"run_start", "run_end"}:
        return f"framework:{framework}:{run_id}"
    if event_type in {"step_end", "node_end", "task_end", "state_checkpoint"}:
        return f"state:{run_id}:{thread_id}"
    return f"events:{run_id}:{thread_id}"


def normalize_event(**kwargs: Any) -> UniversalAgentEvent:
    event = UniversalAgentEvent(**kwargs)
    if not event.channel:
        event.channel = channel_for_event(event)
    return event


def safe_jsonable(value: Any, max_string_chars: int = 4000) -> Any:
    if isinstance(value, str):
        return value if len(value) <= max_string_chars else f"{value[:max_string_chars]}...[truncated]"
    try:
        json.dumps(value)
        return value
    except TypeError:
        pass
    if hasattr(value, "model_dump") and callable(value.model_dump):
        return safe_jsonable(value.model_dump())
    if hasattr(value, "dict") and callable(value.dict):
        return safe_jsonable(value.dict())
    if isinstance(value, dict):
        return {str(key): safe_jsonable(child) for key, child in value.items()}
    if isinstance(value, list | tuple | set):
        return [safe_jsonable(child) for child in value]
    if inspect.isgenerator(value):
        return "[generator]"
    return repr(value)


def summarize_payload(value: Any, max_chars: int = 500) -> str:
    jsonable = safe_jsonable(value)
    try:
        text = json.dumps(jsonable, sort_keys=True)
    except TypeError:
        text = repr(jsonable)
    return text if len(text) <= max_chars else f"{text[:max_chars]}...[truncated]"


def redact_event(event: UniversalAgentEvent) -> UniversalAgentEvent:
    data = event.model_dump()
    clean, _ = redact(data)
    return UniversalAgentEvent.model_validate(clean)


def event_to_checkpoint_payload(event: UniversalAgentEvent) -> dict[str, Any]:
    clean = redact_event(event)
    return safe_jsonable(clean.model_dump(exclude_none=True))

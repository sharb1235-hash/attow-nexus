from __future__ import annotations

import inspect
import json
import time
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

from .redaction import redact

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
    clean, findings = redact(data)
    metadata = dict(clean.get("metadata") or {})
    if findings:
        metadata["redaction_findings"] = findings
    clean["metadata"] = metadata
    return UniversalAgentEvent.model_validate(clean)


def event_to_checkpoint_payload(event: UniversalAgentEvent) -> dict[str, Any]:
    clean = redact_event(event)
    return safe_jsonable(clean.model_dump(exclude_none=True))

from __future__ import annotations

from nexus_ipc.universal import (
    channel_for_event,
    default_thread_id,
    event_to_checkpoint_payload,
    normalize_event,
    safe_jsonable,
    summarize_payload,
)


def test_universal_event_defaults_and_channels() -> None:
    event = normalize_event(
        run_id="r",
        thread_id=default_thread_id("r", "langgraph"),
        agent_id="a",
        framework="langgraph",
        event_type="step_end",
        output={"x": 1},
    )

    assert event.thread_id == "r:main:langgraph"
    assert channel_for_event(event) == "state:r:r:main:langgraph"
    assert event.channel == "state:r:r:main:langgraph"


def test_event_payload_is_jsonable_and_redacted() -> None:
    event = normalize_event(
        run_id="r",
        thread_id="t",
        agent_id="a",
        framework="custom",
        event_type="custom",
        input={"password": "secret", "callable": lambda: None},
    )

    payload = event_to_checkpoint_payload(event)

    assert payload["input"]["password"] == "[REDACTED]"
    assert "callable" in payload["input"]


def test_safe_jsonable_and_summary_handle_non_json_values() -> None:
    value = safe_jsonable({"items": {1, 2}})

    assert sorted(value["items"]) == [1, 2]
    assert summarize_payload({"x": "a" * 600}).endswith("...[truncated]")

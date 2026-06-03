from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from nexus_ipc.universal import UniversalAgentEvent, channel_for_event, event_to_checkpoint_payload

ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = ROOT / "test-fixtures" / "universal-events"
GOLDEN_DIR = ROOT / "test-fixtures" / "golden"
VALID_FIXTURES = sorted(path for path in FIXTURE_DIR.glob("*.json") if not path.name.startswith("malformed-"))
MALFORMED_FIXTURES = sorted(path for path in FIXTURE_DIR.glob("malformed-*.json"))
GOLDEN_FIXTURES = {
    "langgraph-run-start.json": "langgraph-run-start.normalized.json",
    "crewai-task-end.json": "crewai-task-end.normalized.json",
    "vercel-step-finish.json": "vercel-step-finish.normalized.json",
    "error-event.json": "error-event.normalized.json",
    "redaction-event.json": "redaction-event.normalized.json",
    "parent-chain-child.json": "parent-chain-child.normalized.json",
}


@pytest.mark.parametrize("path", VALID_FIXTURES, ids=lambda path: path.name)
def test_valid_universal_event_fixtures_normalize(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    event = UniversalAgentEvent.model_validate(data)
    payload = event_to_checkpoint_payload(event)

    assert payload["schema_version"] == "nexus.universal.v1"
    assert payload["event_id"] == data["event_id"]
    assert payload["run_id"] == data["run_id"]
    assert payload["thread_id"] == data["thread_id"]
    assert payload["agent_id"] == data["agent_id"]
    assert payload["framework"] == data["framework"]
    assert payload["event_type"] == data["event_type"]
    assert channel_for_event(event) == data["channel"]
    assert all(isinstance(parent, str) for parent in payload["parent_commit_ids"])
    assert isinstance(payload["timestamp_ms"], int)


@pytest.mark.parametrize("fixture_name,golden_name", GOLDEN_FIXTURES.items())
def test_golden_normalized_outputs_match(fixture_name: str, golden_name: str) -> None:
    event = UniversalAgentEvent.model_validate(
        json.loads((FIXTURE_DIR / fixture_name).read_text(encoding="utf-8"))
    )
    payload = event_to_checkpoint_payload(event)
    assert _canonical(payload) == (GOLDEN_DIR / golden_name).read_text(encoding="utf-8").strip()


def test_redaction_fixture_redacts_secrets() -> None:
    event = UniversalAgentEvent.model_validate(
        json.loads((FIXTURE_DIR / "redaction-event.json").read_text(encoding="utf-8"))
    )
    payload = event_to_checkpoint_payload(event)
    text = json.dumps(payload, sort_keys=True)

    assert "sk-testsecretvalue" not in text
    assert "secret-token-value" not in text
    assert "correct horse" not in text
    assert payload["input"]["api_key"] == "[REDACTED]"
    assert payload["input"]["headers"]["Authorization"] == "[REDACTED]"
    assert payload["input"]["password"] == "[REDACTED]"


def test_large_payload_fixture_is_deterministic() -> None:
    event = UniversalAgentEvent.model_validate(
        json.loads((FIXTURE_DIR / "large-payload-event.json").read_text(encoding="utf-8"))
    )
    first = event_to_checkpoint_payload(event)
    second = event_to_checkpoint_payload(event)

    assert first == second
    assert first["metadata"]["payload_policy"].startswith("daemon may inline")


@pytest.mark.parametrize("path", MALFORMED_FIXTURES, ids=lambda path: path.name)
def test_malformed_fixtures_fail_validation(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))

    with pytest.raises(ValidationError) as exc_info:
        UniversalAgentEvent.model_validate(data)

    message = str(exc_info.value)
    if "missing-run-id" in path.name:
        assert "run_id" in message
    if "invalid-channel" in path.name:
        assert "channel must match allowed Nexus channel pattern" in message
    if "bad-parent-ids" in path.name:
        assert "parent_commit_ids must be an array of commit ID strings" in message


def _canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

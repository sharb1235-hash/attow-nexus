from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

RUN_ID = "broken-agent-demo"
THREAD_ID = "main"
OBJECTIVE = "Recover a broken local multi-agent config workflow"

PLAN_CHANNEL = "demo:broken-agent:plan"
CODER_CHANNEL = "demo:broken-agent:coder"
REVIEW_CHANNEL = "demo:broken-agent:review"
RECOVERY_CHANNEL = "demo:broken-agent:recovery"
STATE_CHANNEL = "state:broken-agent-demo:main"
EVENTS_CHANNEL = "events:broken-agent-demo:main"

BASE_TAGS = ["broken-agent-demo"]
VALIDATION_ERROR = "retry_limit must be an integer"


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    error: str = ""


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def planner_state() -> dict[str, Any]:
    return {
        "workflow": "toy config update",
        "requested_change": "Add retry_limit to config.",
        "expected_config_shape": {
            "service": "string",
            "retry_limit": "integer",
            "timeout_seconds": "integer",
        },
        "next_agent": "coder-agent",
        "state_status": "last_good",
    }


def coder_state(config: dict[str, Any], *, source: str) -> dict[str, Any]:
    return {
        "workflow": "toy config update",
        "tool": "apply_config_patch",
        "tool_argument": {"config_source": source},
        "generated_config": config,
        "side_effects_simulated": True,
        "side_effect_note": "No file, email, API, deployment, purchase, or database side effect was executed.",
    }


def validate_config(config: dict[str, Any]) -> ValidationResult:
    if not isinstance(config.get("retry_limit"), int):
        return ValidationResult(False, VALIDATION_ERROR)
    return ValidationResult(True)


def reviewer_state(config: dict[str, Any], *, parent_commit_id: str) -> dict[str, Any]:
    result = validate_config(config)
    return {
        "workflow": "toy config update",
        "validated_config": config,
        "validation_passed": result.passed,
        "validation_failed": not result.passed,
        "error": result.error,
        "reviewed_commit_id": parent_commit_id,
    }


def recovery_state(last_good_state: dict[str, Any], fixed_config: dict[str, Any], *, bad_commit_id: str) -> dict[str, Any]:
    return {
        "workflow": "toy config update",
        "replayed_from": "last_good_commit",
        "last_good_state": last_good_state,
        "fixed_config": fixed_config,
        "recovered_from_bad_commit_id": bad_commit_id,
        "validation_passed": validate_config(fixed_config).passed,
        "side_effects_simulated": True,
        "side_effect_note": "Recovery applies only to captured logical agent state.",
    }


def recovery_parent_ids(last_good_commit_id: str) -> list[str]:
    return [last_good_commit_id]

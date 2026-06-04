from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
TOOLS_PATH = ROOT / "examples" / "broken-agent-recovery" / "tools.py"


def load_tools() -> Any:
    spec = importlib.util.spec_from_file_location("broken_agent_recovery_tools", TOOLS_PATH)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_invalid_retry_limit_string_fails_validation() -> None:
    tools = load_tools()

    result = tools.validate_config({"retry_limit": "five"})

    assert result.passed is False
    assert result.error == "retry_limit must be an integer"


def test_valid_retry_limit_integer_passes_validation() -> None:
    tools = load_tools()

    result = tools.validate_config({"retry_limit": 5})

    assert result.passed is True
    assert result.error == ""


def test_recovery_state_is_parented_to_last_good_commit() -> None:
    tools = load_tools()

    parents = tools.recovery_parent_ids("c_last_good")
    state = tools.recovery_state(
        tools.planner_state(),
        {"retry_limit": 5},
        bad_commit_id="c_bad",
    )

    assert parents == ["c_last_good"]
    assert state["recovered_from_bad_commit_id"] == "c_bad"
    assert state["validation_passed"] is True


def test_demo_logic_does_not_require_api_keys() -> None:
    tools = load_tools()

    state = tools.coder_state({"retry_limit": "five"}, source="broken_config.json")

    assert state["side_effects_simulated"] is True
    assert "api_key" not in str(state).lower()

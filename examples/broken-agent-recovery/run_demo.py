from __future__ import annotations

from pathlib import Path

from nexus_ipc import NexusClient

from tools import (
    BASE_TAGS,
    CODER_CHANNEL,
    EVENTS_CHANNEL,
    OBJECTIVE,
    PLAN_CHANNEL,
    RECOVERY_CHANNEL,
    REVIEW_CHANNEL,
    RUN_ID,
    STATE_CHANNEL,
    THREAD_ID,
    VALIDATION_ERROR,
    coder_state,
    load_config,
    planner_state,
    recovery_parent_ids,
    recovery_state,
    reviewer_state,
    validate_config,
)

EXAMPLE_DIR = Path(__file__).resolve().parent


def register_agents(client: NexusClient) -> None:
    client.register_agent(
        agent_id="planner-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        framework="custom",
        language="python",
        capabilities=["planning", "config-design"],
        metadata={"demo": "broken-agent-recovery"},
    )
    client.register_agent(
        agent_id="coder-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        framework="custom",
        language="python",
        capabilities=["config-editing", "tool-use-simulated"],
        metadata={"demo": "broken-agent-recovery"},
    )
    client.register_agent(
        agent_id="reviewer-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        framework="custom",
        language="python",
        capabilities=["validation", "review"],
        metadata={"demo": "broken-agent-recovery"},
    )


def publish_live_context(
    client: NexusClient,
    *,
    agent_id: str,
    event_type: str,
    commit_id: str,
    state: dict[str, object],
) -> None:
    client.publish_delta(
        channel=EVENTS_CHANNEL,
        agent_id=agent_id,
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        durable=False,
        delta={"event_type": event_type, "commit_id": commit_id, "side_effects_simulated": True},
        summary=f"{agent_id} {event_type}",
        tags=[*BASE_TAGS, event_type],
        metadata={"side_effects_simulated": "true"},
    )
    client.publish_delta(
        channel=STATE_CHANNEL,
        agent_id=agent_id,
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        durable=False,
        delta={"latest_commit_id": commit_id, "state": state},
        summary=f"{agent_id} live captured context",
        tags=[*BASE_TAGS, "captured-context"],
        metadata={"side_effects_simulated": "true"},
    )


def main() -> None:
    client = NexusClient.connect()
    register_agents(client)

    broken_config = load_config(EXAMPLE_DIR / "broken_config.json")
    fixed_config = load_config(EXAMPLE_DIR / "fixed_config.json")

    plan_state = planner_state()
    planner_commit = client.checkpoint(
        agent_id="planner-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        channel=PLAN_CHANNEL,
        state=plan_state,
        summary="Planner created retry_limit config plan",
        tags=[*BASE_TAGS, "planner"],
        objective=OBJECTIVE,
        metadata={"event_type": "state_checkpoint", "side_effects_simulated": "true"},
    )
    publish_live_context(
        client,
        agent_id="planner-agent",
        event_type="plan_created",
        commit_id=planner_commit.commit_id,
        state=plan_state,
    )

    invalid_state = coder_state(broken_config, source="broken_config.json")
    bad_commit = client.checkpoint(
        agent_id="coder-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        channel=CODER_CHANNEL,
        state=invalid_state,
        summary="Coder produced invalid retry_limit state",
        tags=[*BASE_TAGS, "coder", "failure"],
        objective=OBJECTIVE,
        parent_commit_ids=[planner_commit.commit_id],
        metadata={
            "event_type": "state_checkpoint",
            "validation_failed": "true",
            "side_effects_simulated": "true",
        },
    )
    publish_live_context(
        client,
        agent_id="coder-agent",
        event_type="invalid_state_created",
        commit_id=bad_commit.commit_id,
        state=invalid_state,
    )

    failure_result = validate_config(broken_config)
    failure_state = reviewer_state(broken_config, parent_commit_id=bad_commit.commit_id)
    failure_commit = client.checkpoint(
        agent_id="reviewer-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        channel=REVIEW_CHANNEL,
        state=failure_state,
        summary=f"Reviewer detected failure: {failure_result.error}",
        tags=[*BASE_TAGS, "reviewer", "failure"],
        objective=OBJECTIVE,
        parent_commit_ids=[bad_commit.commit_id],
        metadata={
            "event_type": "error",
            "error": failure_result.error,
            "validation_failed": "true",
            "side_effects_simulated": "true",
        },
    )
    publish_live_context(
        client,
        agent_id="reviewer-agent",
        event_type="validation_failed",
        commit_id=failure_commit.commit_id,
        state=failure_state,
    )

    fixed_state = recovery_state(plan_state, fixed_config, bad_commit_id=bad_commit.commit_id)
    recovery_commit = client.checkpoint(
        agent_id="coder-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        channel=RECOVERY_CHANNEL,
        state=fixed_state,
        summary="Recovery replayed last good state and applied fixed config",
        tags=[*BASE_TAGS, "coder", "recovery"],
        objective=OBJECTIVE,
        parent_commit_ids=recovery_parent_ids(planner_commit.commit_id),
        metadata={
            "event_type": "recovery",
            "recovered_from_bad_commit_id": bad_commit.commit_id,
            "side_effects_simulated": "true",
        },
    )
    publish_live_context(
        client,
        agent_id="coder-agent",
        event_type="recovery_created",
        commit_id=recovery_commit.commit_id,
        state=fixed_state,
    )

    final_result = validate_config(fixed_config)
    final_state = reviewer_state(fixed_config, parent_commit_id=recovery_commit.commit_id)
    final_commit = client.checkpoint(
        agent_id="reviewer-agent",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        channel=REVIEW_CHANNEL,
        state=final_state,
        summary="Reviewer validation passed after recovery",
        tags=[*BASE_TAGS, "reviewer", "recovery"],
        objective=OBJECTIVE,
        parent_commit_ids=[recovery_commit.commit_id],
        metadata={
            "event_type": "state_checkpoint",
            "validation_passed": str(final_result.passed).lower(),
            "side_effects_simulated": "true",
        },
    )
    publish_live_context(
        client,
        agent_id="reviewer-agent",
        event_type="validation_passed",
        commit_id=final_commit.commit_id,
        state=final_state,
    )

    print("# Attow Nexus Broken Agent Recovery Demo")
    print()
    print("Git gave developers version control for code. Attow Nexus gives developers version control for agent state.")
    print()
    print("1. Planner created plan")
    print(f"   commit: {planner_commit.commit_id}")
    print()
    print("2. Coder produced invalid state")
    print(f"   commit: {bad_commit.commit_id}")
    print('   invalid retry_limit: "five"')
    print()
    print("3. Reviewer detected failure")
    print(f"   commit: {failure_commit.commit_id}")
    print(f"   error: {VALIDATION_ERROR}")
    print()
    print("Bad transition detected:")
    print(f"LAST GOOD COMMIT: {planner_commit.commit_id}")
    print(f"BAD COMMIT: {bad_commit.commit_id}")
    print()
    print("Try:")
    print(f"cargo run -p nexus -- diff {planner_commit.commit_id} {bad_commit.commit_id}")
    print(f"cargo run -p nexus -- replay {planner_commit.commit_id}")
    print()
    print("4. Replayed last good state and applied fix")
    print(f"   RECOVERY COMMIT: {recovery_commit.commit_id}")
    print("   fixed retry_limit: 5")
    print()
    print("5. Reviewer passed")
    print(f"   FINAL PASS COMMIT: {final_commit.commit_id}")
    print("   validation passed")
    print()
    print("Inspect:")
    print("cargo run -p nexus -- log --run broken-agent-demo")
    print(f"cargo run -p nexus -- diff {planner_commit.commit_id} {bad_commit.commit_id}")
    print(f"cargo run -p nexus -- diff {planner_commit.commit_id} {recovery_commit.commit_id}")
    print(f"cargo run -p nexus -- replay {final_commit.commit_id}")
    print()
    print("Note: replay and recovery apply to captured logical agent state only.")
    print("No real external side effects were executed in this demo.")


if __name__ == "__main__":
    main()

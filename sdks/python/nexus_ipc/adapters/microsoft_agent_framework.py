from __future__ import annotations

from typing import Any

from nexus_ipc.client import NexusClient


def record_middleware_step(
    client: NexusClient,
    agent_id: str,
    run_id: str,
    step_name: str,
    state: dict[str, Any],
) -> None:
    client.checkpoint(
        agent_id=agent_id,
        run_id=run_id,
        channel=f"topic:microsoft_agent_{step_name}",
        state=state,
        summary=f"Microsoft Agent Framework step {step_name}",
        tags=["microsoft-agent-framework"],
    )


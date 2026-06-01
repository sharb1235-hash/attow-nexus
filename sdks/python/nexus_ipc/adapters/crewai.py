from __future__ import annotations

from typing import Any

from nexus_ipc.client import NexusClient


def record_task_result(
    client: NexusClient,
    agent_id: str,
    run_id: str,
    role: str,
    task_name: str,
    result: dict[str, Any],
) -> None:
    client.checkpoint(
        agent_id=agent_id,
        run_id=run_id,
        channel=f"topic:crew_{task_name}",
        state={"role": role, "task": task_name, "result": result},
        summary=f"Crew task {task_name} completed",
        tags=["crewai", "task"],
    )


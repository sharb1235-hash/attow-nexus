from __future__ import annotations

from collections.abc import Callable
from typing import Any

from nexus_ipc.client import NexusClient


def record_node_transition(
    client: NexusClient,
    agent_id: str,
    run_id: str,
    node_name: str,
    state: dict[str, Any],
) -> None:
    client.checkpoint(
        agent_id=agent_id,
        run_id=run_id,
        channel=f"topic:langgraph_{node_name}",
        state={"node": node_name, "state": state},
        summary=f"LangGraph node {node_name} transition",
        tags=["langgraph", "node"],
    )


def wrap_node(
    client: NexusClient,
    agent_id: str,
    run_id: str,
    node_name: str,
    node: Callable[[dict[str, Any]], dict[str, Any]],
) -> Callable[[dict[str, Any]], dict[str, Any]]:
    def wrapped(state: dict[str, Any]) -> dict[str, Any]:
        result = node(state)
        record_node_transition(client, agent_id, run_id, node_name, result)
        return result

    return wrapped


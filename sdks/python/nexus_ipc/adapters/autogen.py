from __future__ import annotations

from typing import Any

from nexus_ipc.client import NexusClient


def record_message(
    client: NexusClient,
    agent_id: str,
    run_id: str,
    channel: str,
    sender: str,
    content: str,
) -> None:
    client.publish_delta(
        channel=channel,
        agent_id=agent_id,
        run_id=run_id,
        delta={"sender": sender, "content": content},
        durable=True,
        tags=["autogen", "message"],
    )


def middleware_event(client: NexusClient, agent_id: str, run_id: str, event: dict[str, Any]) -> None:
    client.checkpoint(
        agent_id=agent_id,
        run_id=run_id,
        channel="topic:autogen_events",
        state=event,
        summary="AutoGen middleware event",
        tags=["autogen"],
    )


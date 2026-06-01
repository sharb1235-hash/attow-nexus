from __future__ import annotations

from collections.abc import Callable
from typing import Any

from nexus_ipc.client import NexusClient


class NexusAgentAdapter:
    def __init__(
        self,
        client: NexusClient,
        agent_id: str,
        run_id: str,
        channel: str,
    ) -> None:
        self.client = client
        self.agent_id = agent_id
        self.run_id = run_id
        self.channel = channel

    def wrap_step(self, func: Callable[..., Any]) -> Callable[..., Any]:
        def wrapped(state: dict[str, Any], *args: Any, **kwargs: Any) -> Any:
            self.client.publish_delta(
                channel=self.channel,
                agent_id=self.agent_id,
                run_id=self.run_id,
                delta={"phase": "input", "state": state},
                durable=False,
            )
            try:
                result = func(state, *args, **kwargs)
            except Exception as exc:
                self.client.checkpoint(
                    agent_id=self.agent_id,
                    run_id=self.run_id,
                    channel=self.channel,
                    state={"phase": "error", "error_type": type(exc).__name__},
                    summary=f"{func.__name__} failed",
                )
                raise
            output_state = result if isinstance(result, dict) else {"result": result}
            self.client.checkpoint(
                agent_id=self.agent_id,
                run_id=self.run_id,
                channel=self.channel,
                state=output_state,
                summary=f"{func.__name__} completed",
            )
            return result

        return wrapped


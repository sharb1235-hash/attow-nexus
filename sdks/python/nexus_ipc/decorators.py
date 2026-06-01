from __future__ import annotations

import functools
from typing import Any, Callable, TypeVar

from .client import NexusClient

F = TypeVar("F", bound=Callable[..., Any])


def nexus_checkpoint(
    agent_id: str,
    channel: str,
    run_id: str = "decorated-run",
    client: NexusClient | None = None,
) -> Callable[[F], F]:
    sdk_client = client or NexusClient.connect()

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            result = func(*args, **kwargs)
            state = result if isinstance(result, dict) else {"result": result}
            sdk_client.checkpoint(
                agent_id=agent_id,
                run_id=run_id,
                channel=channel,
                state=state,
                summary=f"Checkpoint after {func.__name__}",
            )
            return result

        return wrapper  # type: ignore[return-value]

    return decorator


def nexus_tool(
    name: str,
    agent_id: str = "tool-agent",
    run_id: str = "tool-run",
    channel: str | None = None,
    client: NexusClient | None = None,
) -> Callable[[F], F]:
    sdk_client = client or NexusClient.connect()
    tool_channel = channel or f"tool:{name}"

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            sdk_client.publish_delta(
                channel=tool_channel,
                agent_id=agent_id,
                run_id=run_id,
                delta={"tool": name, "phase": "started"},
                durable=False,
            )
            try:
                result = func(*args, **kwargs)
            except Exception as exc:
                sdk_client.checkpoint(
                    agent_id=agent_id,
                    run_id=run_id,
                    channel=tool_channel,
                    state={"tool": name, "error": type(exc).__name__},
                    summary=f"Tool {name} failed",
                )
                raise
            sdk_client.checkpoint(
                agent_id=agent_id,
                run_id=run_id,
                channel=tool_channel,
                state={"tool": name, "result": result},
                summary=f"Tool {name} finished",
            )
            return result

        return wrapper  # type: ignore[return-value]

    return decorator


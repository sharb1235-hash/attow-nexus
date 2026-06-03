from __future__ import annotations

import copy
from collections.abc import Awaitable, Callable, Iterable
from typing import Any

from nexus_ipc.client import NexusClient
from nexus_ipc.universal import safe_jsonable

from .base import NexusAdapterBase


def instrument_crewai(
    crew: Any,
    client: NexusClient | None = None,
    run_id: str | None = None,
    agent_id: str = "crewai",
    thread_id: str | None = None,
    durable: bool = True,
    capture_inputs: bool = True,
    capture_outputs: bool = True,
    capture_steps: bool = True,
    capture_errors: bool = True,
    fail_open: bool = True,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> "NexusCrewAIProxy":
    """Wrap a CrewAI crew using public kickoff and callback-style surfaces."""

    return NexusCrewAIProxy(
        crew=crew,
        client=client or NexusClient.connect(),
        run_id=run_id or "crewai-run",
        agent_id=agent_id,
        thread_id=thread_id,
        durable=durable,
        capture_inputs=capture_inputs,
        capture_outputs=capture_outputs,
        capture_steps=capture_steps,
        capture_errors=capture_errors,
        fail_open=fail_open,
        tags=tags or [],
        metadata=metadata or {},
    )


class NexusCrewAIProxy(NexusAdapterBase):
    framework_name = "crewai"

    def __init__(
        self,
        crew: Any,
        client: NexusClient,
        run_id: str,
        agent_id: str,
        thread_id: str | None,
        durable: bool,
        capture_inputs: bool,
        capture_outputs: bool,
        capture_steps: bool,
        capture_errors: bool,
        fail_open: bool,
        tags: list[str],
        metadata: dict[str, Any],
    ) -> None:
        super().__init__(
            client=client,
            run_id=run_id,
            agent_id=agent_id,
            thread_id=thread_id,
            durable=durable,
            fail_open=fail_open,
            tags=tags,
            metadata=metadata,
        )
        self.wrapped_crew = crew
        self.nexus_wrapped_crew = crew
        self.capture_inputs = capture_inputs
        self.capture_outputs = capture_outputs
        self.capture_steps = capture_steps
        self.capture_errors = capture_errors
        self._attach_step_callback_if_present()

    def __repr__(self) -> str:
        return f"NexusCrewAIProxy({self.wrapped_crew!r})"

    def __getattr__(self, name: str) -> Any:
        return getattr(self.wrapped_crew, name)

    def kickoff(self, *args: Any, **kwargs: Any) -> Any:
        if not hasattr(self.wrapped_crew, "kickoff"):
            raise AttributeError("wrapped crew does not expose kickoff")
        return self._run_sync("kickoff", self.wrapped_crew.kickoff, args, kwargs)

    def kickoff_for_each(self, inputs: Iterable[Any], *args: Any, **kwargs: Any) -> Any:
        if not hasattr(self.wrapped_crew, "kickoff_for_each"):
            raise AttributeError("wrapped crew does not expose kickoff_for_each")
        return self._run_sync("kickoff_for_each", self.wrapped_crew.kickoff_for_each, (inputs, *args), kwargs)

    async def kickoff_async(self, *args: Any, **kwargs: Any) -> Any:
        if not hasattr(self.wrapped_crew, "kickoff_async"):
            raise AttributeError("wrapped crew does not expose kickoff_async")
        return await self._run_async("kickoff_async", self.wrapped_crew.kickoff_async, args, kwargs)

    def _run_sync(self, method: str, func: Callable[..., Any], args: tuple[Any, ...], kwargs: dict[str, Any]) -> Any:
        thread_id = self.derive_thread_id()
        self.register(thread_id)
        parents = self._checkpoint_start(method, thread_id, args, kwargs)
        try:
            result = func(*args, **copy.deepcopy(kwargs))
        except Exception as exc:
            self._checkpoint_error(method, exc, thread_id, parents)
            raise
        self._checkpoint_end(method, thread_id, result, parents)
        return result

    async def _run_async(
        self,
        method: str,
        func: Callable[..., Awaitable[Any]],
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
    ) -> Any:
        thread_id = self.derive_thread_id()
        self.register(thread_id)
        parents = self._checkpoint_start(method, thread_id, args, kwargs)
        try:
            result = await func(*args, **copy.deepcopy(kwargs))
        except Exception as exc:
            self._checkpoint_error(method, exc, thread_id, parents)
            raise
        self._checkpoint_end(method, thread_id, result, parents)
        return result

    def _attach_step_callback_if_present(self) -> None:
        if not self.capture_steps or not hasattr(self.wrapped_crew, "step_callback"):
            return
        original = getattr(self.wrapped_crew, "step_callback")
        if getattr(original, "_nexus_wrapped", False):
            return

        def composed_step_callback(*args: Any, **kwargs: Any) -> Any:
            thread_id = self.derive_thread_id()
            self.checkpoint_event(
                self.event(
                    "task_end",
                    thread_id=thread_id,
                    task_name="crew_step",
                    output=safe_jsonable({"args": args, "kwargs": kwargs}),
                    metadata={"source": "step_callback"},
                )
            )
            if callable(original):
                return original(*args, **kwargs)
            return None

        setattr(composed_step_callback, "_nexus_wrapped", True)
        setattr(self.wrapped_crew, "step_callback", composed_step_callback)

    def _checkpoint_start(
        self, method: str, thread_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]
    ) -> list[str]:
        return self.checkpoint_event(
            self.event(
                "run_start",
                thread_id=thread_id,
                task_name=method,
                input=safe_jsonable({"args": args, "kwargs": kwargs}) if self.capture_inputs else "[not captured]",
                metadata={"method": method},
            )
        )

    def _checkpoint_end(self, method: str, thread_id: str, result: Any, parents: list[str]) -> list[str]:
        latest_parent = self._last_commit_id_by_thread.get(thread_id)
        return self.checkpoint_event(
            self.event(
                "run_end",
                thread_id=thread_id,
                task_name=method,
                output=safe_jsonable(result) if self.capture_outputs else "[not captured]",
                parent_commit_ids=[latest_parent] if latest_parent else parents,
                metadata={"method": method},
            )
        )

    def _checkpoint_error(self, method: str, exc: Exception, thread_id: str, parents: list[str]) -> list[str]:
        if not self.capture_errors:
            return parents
        latest_parent = self._last_commit_id_by_thread.get(thread_id)
        return self.checkpoint_event(
            self.event(
                "error",
                thread_id=thread_id,
                task_name=method,
                error={"type": type(exc).__name__, "message": str(exc)},
                parent_commit_ids=[latest_parent] if latest_parent else parents,
                metadata={"method": method},
            )
        )


def record_task_result(
    client: NexusClient,
    agent_id: str,
    run_id: str,
    role: str,
    task_name: str,
    result: dict[str, Any],
) -> None:
    adapter = _CrewTaskRecorder(client=client, run_id=run_id, agent_id=agent_id)
    adapter.checkpoint_event(
        adapter.event(
            "task_end",
            task_name=task_name,
            output={"role": role, "task": task_name, "result": safe_jsonable(result)},
            channel=f"topic:crew_{task_name}",
        )
    )


class _CrewTaskRecorder(NexusAdapterBase):
    framework_name = "crewai"

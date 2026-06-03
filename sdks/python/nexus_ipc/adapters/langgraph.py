from __future__ import annotations

import copy
from collections.abc import AsyncIterator, Callable, Iterator, Sequence
from typing import Any

from nexus_ipc.client import NexusClient
from nexus_ipc.universal import safe_jsonable, summarize_payload

from .base import NexusAdapterBase

DEFAULT_MAX_STREAM_EVENTS = 100


def instrument_langgraph(
    graph: Any,
    client: NexusClient | None = None,
    run_id: str | None = None,
    agent_id: str = "langgraph",
    thread_id: str | None = None,
    channel_prefix: str = "langgraph",
    durable: bool = True,
    capture_inputs: bool = True,
    capture_outputs: bool = True,
    capture_stream_updates: bool = True,
    capture_errors: bool = True,
    max_stream_events: int = DEFAULT_MAX_STREAM_EVENTS,
    fail_open: bool = True,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> "NexusLangGraphProxy":
    """Wrap a compiled LangGraph graph using public invoke/stream surfaces.

    Node functions and LangGraph state schemas do not need Nexus imports or fields. This wrapper
    records canonical universal events at graph boundaries and delegates all normal behavior.
    """

    return NexusLangGraphProxy(
        graph=graph,
        client=client or NexusClient.connect(),
        run_id=run_id or "langgraph-run",
        agent_id=agent_id,
        thread_id=thread_id,
        channel_prefix=channel_prefix,
        durable=durable,
        capture_inputs=capture_inputs,
        capture_outputs=capture_outputs,
        capture_stream_updates=capture_stream_updates,
        capture_errors=capture_errors,
        max_stream_events=max_stream_events,
        fail_open=fail_open,
        tags=tags or [],
        metadata=metadata or {},
    )


class NexusLangGraphProxy(NexusAdapterBase):
    framework_name = "langgraph"

    def __init__(
        self,
        graph: Any,
        client: NexusClient,
        run_id: str,
        agent_id: str,
        thread_id: str | None,
        channel_prefix: str,
        durable: bool,
        capture_inputs: bool,
        capture_outputs: bool,
        capture_stream_updates: bool,
        capture_errors: bool,
        max_stream_events: int,
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
            metadata={**metadata, "channel_prefix": channel_prefix},
        )
        self.wrapped_graph = graph
        self.nexus_wrapped_graph = graph
        self.channel_prefix = channel_prefix
        self.capture_inputs = capture_inputs
        self.capture_outputs = capture_outputs
        self.capture_stream_updates = capture_stream_updates
        self.capture_errors = capture_errors
        self.max_stream_events = max(0, max_stream_events)

    def __repr__(self) -> str:
        return f"NexusLangGraphProxy({self.wrapped_graph!r})"

    def __getattr__(self, name: str) -> Any:
        return getattr(self.wrapped_graph, name)

    def invoke(self, input: Any, config: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        if not hasattr(self.wrapped_graph, "invoke"):
            raise AttributeError("wrapped graph does not expose invoke")
        prepared = self._prepare_call("invoke", config)
        parents = self._checkpoint_start("invoke", input, prepared.thread_id)
        try:
            result = self.wrapped_graph.invoke(input, config=prepared.config, **kwargs)
        except Exception as exc:
            self._checkpoint_error("invoke", exc, prepared.thread_id, parents)
            raise
        self._checkpoint_end("invoke", result, prepared.thread_id, parents)
        return result

    async def ainvoke(self, input: Any, config: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        if not hasattr(self.wrapped_graph, "ainvoke"):
            raise AttributeError("wrapped graph does not expose ainvoke")
        prepared = self._prepare_call("ainvoke", config)
        parents = self._checkpoint_start("ainvoke", input, prepared.thread_id)
        try:
            result = await self.wrapped_graph.ainvoke(input, config=prepared.config, **kwargs)
        except Exception as exc:
            self._checkpoint_error("ainvoke", exc, prepared.thread_id, parents)
            raise
        self._checkpoint_end("ainvoke", result, prepared.thread_id, parents)
        return result

    def stream(self, input: Any, config: dict[str, Any] | None = None, **kwargs: Any) -> Iterator[Any]:
        if not hasattr(self.wrapped_graph, "stream"):
            raise AttributeError("wrapped graph does not expose stream")
        prepared = self._prepare_call("stream", config)

        def generator() -> Iterator[Any]:
            parents = self._checkpoint_start("stream", input, prepared.thread_id)
            last_chunk: Any = None
            seen = 0
            skipped = 0
            try:
                for chunk in self.wrapped_graph.stream(input, config=prepared.config, **kwargs):
                    last_chunk = chunk
                    if self.capture_stream_updates and seen < self.max_stream_events:
                        parents = self._checkpoint_stream_delta("stream", chunk, prepared.thread_id, parents, seen)
                    elif self.capture_stream_updates:
                        skipped += 1
                    seen += 1
                    yield chunk
            except Exception as exc:
                self._checkpoint_error("stream", exc, prepared.thread_id, parents)
                raise
            self._checkpoint_stream_end("stream", last_chunk, prepared.thread_id, parents, seen, skipped)

        return generator()

    def astream(self, input: Any, config: dict[str, Any] | None = None, **kwargs: Any) -> AsyncIterator[Any]:
        if not hasattr(self.wrapped_graph, "astream"):
            raise AttributeError("wrapped graph does not expose astream")
        prepared = self._prepare_call("astream", config)

        async def generator() -> AsyncIterator[Any]:
            parents = self._checkpoint_start("astream", input, prepared.thread_id)
            last_chunk: Any = None
            seen = 0
            skipped = 0
            try:
                async for chunk in self.wrapped_graph.astream(input, config=prepared.config, **kwargs):
                    last_chunk = chunk
                    if self.capture_stream_updates and seen < self.max_stream_events:
                        parents = self._checkpoint_stream_delta("astream", chunk, prepared.thread_id, parents, seen)
                    elif self.capture_stream_updates:
                        skipped += 1
                    seen += 1
                    yield chunk
            except Exception as exc:
                self._checkpoint_error("astream", exc, prepared.thread_id, parents)
                raise
            self._checkpoint_stream_end("astream", last_chunk, prepared.thread_id, parents, seen, skipped)

        return generator()

    def batch(self, inputs: Sequence[Any], config: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        if not hasattr(self.wrapped_graph, "batch"):
            raise AttributeError("wrapped graph does not expose batch")
        prepared = self._prepare_call("batch", config)
        parents = self._checkpoint_start("batch", list(inputs), prepared.thread_id)
        try:
            result = self.wrapped_graph.batch(inputs, config=prepared.config, **kwargs)
        except Exception as exc:
            self._checkpoint_error("batch", exc, prepared.thread_id, parents)
            raise
        self._checkpoint_end("batch", result, prepared.thread_id, parents)
        return result

    def _prepare_call(self, method: str, config: dict[str, Any] | None) -> "_PreparedCall":
        next_config = _copy_config(config)
        thread_id = _derive_thread_id(self.run_id, next_config, self.thread_id, self.framework_name)
        _ensure_configurable_thread_id(next_config, thread_id)
        metadata = dict(next_config.get("metadata") or {})
        metadata.update(
            {
                "nexus_run_id": self.run_id,
                "nexus_agent_id": self.agent_id,
                "nexus_thread_id": thread_id,
                "nexus_method": method,
            }
        )
        next_config["metadata"] = metadata
        _merge_callbacks(next_config, NexusCallbackHandler(self, thread_id))
        self.register(thread_id)
        return _PreparedCall(config=next_config, thread_id=thread_id)

    def _checkpoint_start(self, method: str, input_state: Any, thread_id: str) -> list[str]:
        parents = self.checkpoint_event(
            self.event(
                "run_start",
                thread_id=thread_id,
                step_name=method,
                input=safe_jsonable(input_state) if self.capture_inputs else "[not captured]",
                metadata={"method": method},
            )
        )
        return self.checkpoint_event(
            self.event(
                "step_start",
                thread_id=thread_id,
                step_name=method,
                input=safe_jsonable(input_state) if self.capture_inputs else "[not captured]",
                parent_commit_ids=parents,
                metadata={"method": method},
            )
        )

    def _checkpoint_end(self, method: str, output_state: Any, thread_id: str, parents: list[str]) -> list[str]:
        step_parents = self.checkpoint_event(
            self.event(
                "step_end",
                thread_id=thread_id,
                step_name=method,
                output=safe_jsonable(output_state) if self.capture_outputs else "[not captured]",
                parent_commit_ids=parents,
                metadata={"method": method},
            )
        )
        return self.checkpoint_event(
            self.event(
                "run_end",
                thread_id=thread_id,
                step_name=method,
                output=safe_jsonable(output_state) if self.capture_outputs else "[not captured]",
                parent_commit_ids=step_parents,
                metadata={"method": method},
            )
        )

    def _checkpoint_stream_delta(
        self, method: str, chunk: Any, thread_id: str, parents: list[str], sequence: int
    ) -> list[str]:
        return self.checkpoint_event(
            self.event(
                "stream_delta",
                thread_id=thread_id,
                step_name=method,
                delta={"sequence": sequence, "chunk": safe_jsonable(chunk)},
                parent_commit_ids=parents,
                metadata={"method": method},
            )
        )

    def _checkpoint_stream_end(
        self,
        method: str,
        last_chunk: Any,
        thread_id: str,
        parents: list[str],
        seen: int,
        skipped: int,
    ) -> list[str]:
        step_parents = self.checkpoint_event(
            self.event(
                "step_end",
                thread_id=thread_id,
                step_name=method,
                output=safe_jsonable(last_chunk) if self.capture_outputs else "[not captured]",
                parent_commit_ids=parents,
                metadata={"method": method, "stream_events_seen": seen, "stream_events_skipped": skipped},
            )
        )
        return self.checkpoint_event(
            self.event(
                "run_end",
                thread_id=thread_id,
                step_name=method,
                output=safe_jsonable(last_chunk) if self.capture_outputs else "[not captured]",
                parent_commit_ids=step_parents,
                metadata={"method": method, "stream_events_seen": seen, "stream_events_skipped": skipped},
            )
        )

    def _checkpoint_error(self, method: str, exc: Exception, thread_id: str, parents: list[str]) -> list[str]:
        if not self.capture_errors:
            return parents
        return self.checkpoint_event(
            self.event(
                "error",
                thread_id=thread_id,
                step_name=method,
                error={"type": type(exc).__name__, "message": str(exc)},
                parent_commit_ids=parents,
                metadata={"method": method},
            )
        )


class NexusCallbackHandler:
    """Best-effort public callback handler for LangChain/LangGraph callback surfaces."""

    def __init__(self, proxy: NexusLangGraphProxy, thread_id: str) -> None:
        self.proxy = proxy
        self.thread_id = thread_id

    def on_chain_start(self, serialized: Any, inputs: Any, **kwargs: Any) -> None:
        self.proxy.checkpoint_event(
            self.proxy.event(
                "node_start",
                thread_id=self.thread_id,
                input=safe_jsonable(inputs),
                metadata={"serialized": summarize_payload(serialized), "callback": "on_chain_start"},
            )
        )

    def on_chain_end(self, outputs: Any, **kwargs: Any) -> None:
        self.proxy.checkpoint_event(
            self.proxy.event(
                "node_end",
                thread_id=self.thread_id,
                output=safe_jsonable(outputs),
                metadata={"callback": "on_chain_end"},
            )
        )

    def on_chain_error(self, error: BaseException, **kwargs: Any) -> None:
        self.proxy.checkpoint_event(
            self.proxy.event(
                "error",
                thread_id=self.thread_id,
                error={"type": type(error).__name__, "message": str(error)},
                metadata={"callback": "on_chain_error"},
            )
        )

    @property
    def ignore_agent(self) -> bool:
        return False

    @property
    def ignore_chain(self) -> bool:
        return False

    @property
    def ignore_llm(self) -> bool:
        return True

    @property
    def ignore_retriever(self) -> bool:
        return True

    @property
    def raise_error(self) -> bool:
        return False


def record_node_transition(
    client: NexusClient,
    agent_id: str,
    run_id: str,
    node_name: str,
    state: dict[str, Any],
) -> None:
    adapter = _NodeRecorder(client=client, run_id=run_id, agent_id=agent_id)
    adapter.checkpoint_event(
        adapter.event(
            "node_end",
            node_name=node_name,
            output=safe_jsonable(state),
            channel=f"topic:langgraph_{node_name}",
        )
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


class _NodeRecorder(NexusAdapterBase):
    framework_name = "langgraph"


class _PreparedCall:
    def __init__(self, config: dict[str, Any], thread_id: str) -> None:
        self.config = config
        self.thread_id = thread_id


def _copy_config(config: dict[str, Any] | None) -> dict[str, Any]:
    if config is None:
        return {}
    copied = copy.deepcopy(config)
    if "callbacks" in config:
        callbacks = config["callbacks"]
        if isinstance(callbacks, list):
            copied["callbacks"] = list(callbacks)
        elif isinstance(callbacks, tuple):
            copied["callbacks"] = tuple(callbacks)
        else:
            copied["callbacks"] = callbacks
    return copied


def _derive_thread_id(
    run_id: str, config: dict[str, Any], explicit_thread_id: str | None, framework: str
) -> str:
    configurable = config.get("configurable")
    if isinstance(configurable, dict) and configurable.get("thread_id"):
        return str(configurable["thread_id"])
    return explicit_thread_id or f"{run_id}:main:{framework}"


def _ensure_configurable_thread_id(config: dict[str, Any], default_thread_id: str) -> None:
    configurable = config.get("configurable")
    if not isinstance(configurable, dict):
        configurable = {}
    else:
        configurable = dict(configurable)
    configurable.setdefault("thread_id", default_thread_id)
    config["configurable"] = configurable


def _merge_callbacks(config: dict[str, Any], callback: NexusCallbackHandler) -> None:
    callbacks = config.get("callbacks")
    if callbacks is None:
        config["callbacks"] = [callback]
    elif isinstance(callbacks, list):
        config["callbacks"] = [*callbacks, callback]
    elif isinstance(callbacks, tuple):
        config["callbacks"] = [*callbacks, callback]

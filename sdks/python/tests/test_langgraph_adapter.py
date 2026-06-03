from __future__ import annotations

import asyncio

import pytest

from nexus_ipc.adapters.langgraph import NexusLangGraphProxy, instrument_langgraph, wrap_node
from nexus_ipc.models import CommitResult


class RecordingNexusClient:
    def __init__(self) -> None:
        self.events: list[dict[str, object]] = []
        self.count = 0

    def register_agent(self, **kwargs: object) -> dict[str, object]:
        self.events.append({"type": "register_agent", **kwargs})
        return {"accepted": True}

    def checkpoint(self, **kwargs: object) -> CommitResult:
        self.count += 1
        commit_id = f"c_{self.count}"
        self.events.append({"type": "checkpoint", "commit_id": commit_id, **kwargs})
        return CommitResult.model_validate(
            {"deltaId": f"delta_{self.count}", "commitId": commit_id, "accepted": True, "persisted": True}
        )


class FakeCompiledGraph:
    description = "fake compiled graph"

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.last_config: dict[str, object] | None = None

    def invoke(self, input: dict[str, object], config: dict[str, object] | None = None, **kwargs: object) -> dict[str, object]:
        self.last_config = config
        if self.fail:
            raise ValueError("graph failed")
        return {"result": input["value"], "config_thread": config["configurable"]["thread_id"]}  # type: ignore[index]

    async def ainvoke(
        self, input: dict[str, object], config: dict[str, object] | None = None, **kwargs: object
    ) -> dict[str, object]:
        self.last_config = config
        return {"async_result": input["value"]}

    def stream(self, input: dict[str, object], config: dict[str, object] | None = None, **kwargs: object):
        self.last_config = config
        if self.fail:
            raise RuntimeError("stream failed")
        yield {"chunk": 1}
        yield {"chunk": 2}

    async def astream(self, input: dict[str, object], config: dict[str, object] | None = None, **kwargs: object):
        self.last_config = config
        yield {"chunk": "a"}
        yield {"chunk": "b"}


def checkpoints(client: RecordingNexusClient) -> list[dict[str, object]]:
    return [event for event in client.events if event["type"] == "checkpoint"]


def test_langgraph_wrapper_records_public_node_transition() -> None:
    client = RecordingNexusClient()

    def node(state: dict[str, int]) -> dict[str, int]:
        return {"x": state["x"] + 1}

    wrapped = wrap_node(client, "a", "r", "plan", node)  # type: ignore[arg-type]
    assert wrapped({"x": 1}) == {"x": 2}
    assert checkpoints(client)[-1]["type"] == "checkpoint"


def test_instrument_langgraph_returns_proxy_and_delegates_unknown_attributes() -> None:
    graph = FakeCompiledGraph()
    proxy = instrument_langgraph(graph, client=RecordingNexusClient(), run_id="run-1")
    assert isinstance(proxy, NexusLangGraphProxy)
    assert proxy.description == "fake compiled graph"
    assert proxy.wrapped_graph is graph
    assert proxy.nexus_wrapped_graph is graph


def test_invoke_returns_original_output_and_does_not_mutate_config() -> None:
    client = RecordingNexusClient()
    graph = FakeCompiledGraph()
    proxy = instrument_langgraph(graph, client=client, run_id="run-1")
    callback = object()
    original_config = {"configurable": {}, "callbacks": [callback], "metadata": {"existing": "yes"}}

    result = proxy.invoke({"value": "ok"}, config=original_config)

    assert result == {"result": "ok", "config_thread": "run-1:main:langgraph"}
    assert original_config == {"configurable": {}, "callbacks": [callback], "metadata": {"existing": "yes"}}
    assert graph.last_config is not original_config
    assert graph.last_config["configurable"]["thread_id"] == "run-1:main:langgraph"  # type: ignore[index]
    assert callback in graph.last_config["callbacks"]  # type: ignore[index]
    assert graph.last_config["metadata"]["existing"] == "yes"  # type: ignore[index]
    assert graph.last_config["metadata"]["nexus_run_id"] == "run-1"  # type: ignore[index]


def test_invoke_respects_existing_thread_id_and_checkpoints_start_end_chain() -> None:
    client = RecordingNexusClient()
    graph = FakeCompiledGraph()
    proxy = instrument_langgraph(graph, client=client, run_id="run-1", agent_id="lg")

    proxy.invoke({"value": "ok"}, config={"configurable": {"thread_id": "thread-1"}})

    register_events = [event for event in client.events if event["type"] == "register_agent"]
    assert len(register_events) == 1
    assert register_events[0]["thread_id"] == "thread-1"

    commits = checkpoints(client)
    assert len(commits) == 4
    assert commits[0]["channel"] == "framework:langgraph:run-1"
    assert commits[0]["state"]["event_type"] == "run_start"  # type: ignore[index]
    assert commits[1]["channel"] == "events:run-1:thread-1"
    assert commits[1]["state"]["event_type"] == "step_start"  # type: ignore[index]
    assert commits[1]["state"]["step_name"] == "invoke"  # type: ignore[index]
    assert commits[2]["channel"] == "state:run-1:thread-1"
    assert commits[2]["state"]["event_type"] == "step_end"  # type: ignore[index]
    assert commits[2]["parent_commit_ids"] == ["c_2"]
    assert commits[3]["channel"] == "framework:langgraph:run-1"
    assert commits[3]["state"]["event_type"] == "run_end"  # type: ignore[index]


def test_stream_yields_original_chunks_and_checkpoints_updates() -> None:
    client = RecordingNexusClient()
    graph = FakeCompiledGraph()
    proxy = instrument_langgraph(graph, client=client, run_id="run-1", max_stream_events=10)

    chunks = list(proxy.stream({"value": "ok"}, config={"configurable": {"thread_id": "t"}}))

    assert chunks == [{"chunk": 1}, {"chunk": 2}]
    commits = checkpoints(client)
    assert [commit["state"]["event_type"] for commit in commits] == [  # type: ignore[index]
        "run_start",
        "step_start",
        "stream_delta",
        "stream_delta",
        "step_end",
        "run_end",
    ]
    assert commits[2]["parent_commit_ids"] == ["c_2"]
    assert commits[3]["parent_commit_ids"] == ["c_3"]
    assert commits[4]["parent_commit_ids"] == ["c_4"]


def test_stream_capture_is_bounded() -> None:
    client = RecordingNexusClient()
    graph = FakeCompiledGraph()
    proxy = instrument_langgraph(graph, client=client, run_id="run-1", max_stream_events=1)

    assert list(proxy.stream({"value": "ok"})) == [{"chunk": 1}, {"chunk": 2}]
    commits = checkpoints(client)
    assert [commit["state"]["event_type"] for commit in commits] == [  # type: ignore[index]
        "run_start",
        "step_start",
        "stream_delta",
        "step_end",
        "run_end",
    ]
    assert commits[-1]["state"]["metadata"]["stream_events_seen"] == 2  # type: ignore[index]
    assert commits[-1]["state"]["metadata"]["stream_events_skipped"] == 1  # type: ignore[index]


def test_errors_are_checkpointed_and_reraised() -> None:
    client = RecordingNexusClient()
    proxy = instrument_langgraph(FakeCompiledGraph(fail=True), client=client, run_id="run-1")

    with pytest.raises(ValueError, match="graph failed"):
        proxy.invoke({"value": "ok"})

    commits = checkpoints(client)
    assert [commit["state"]["event_type"] for commit in commits] == ["run_start", "step_start", "error"]  # type: ignore[index]
    assert commits[-1]["state"]["error"]["type"] == "ValueError"  # type: ignore[index]
    assert commits[-1]["parent_commit_ids"] == ["c_2"]


def test_async_invoke_works() -> None:
    client = RecordingNexusClient()
    proxy = instrument_langgraph(FakeCompiledGraph(), client=client, run_id="run-1")

    result = asyncio.run(proxy.ainvoke({"value": "ok"}))

    assert result == {"async_result": "ok"}
    assert [commit["state"]["event_type"] for commit in checkpoints(client)] == [  # type: ignore[index]
        "run_start",
        "step_start",
        "step_end",
        "run_end",
    ]


def test_async_stream_works() -> None:
    client = RecordingNexusClient()
    proxy = instrument_langgraph(FakeCompiledGraph(), client=client, run_id="run-1")

    async def collect() -> list[dict[str, object]]:
        return [chunk async for chunk in proxy.astream({"value": "ok"})]

    chunks = asyncio.run(collect())

    assert chunks == [{"chunk": "a"}, {"chunk": "b"}]
    assert [commit["state"]["event_type"] for commit in checkpoints(client)] == [  # type: ignore[index]
        "run_start",
        "step_start",
        "stream_delta",
        "stream_delta",
        "step_end",
        "run_end",
    ]


def test_real_langgraph_compiled_graph_smoke_if_installed() -> None:
    pytest.importorskip("langgraph")
    from typing import TypedDict

    from langgraph.graph import END, START, StateGraph

    class DemoState(TypedDict):
        messages: list[str]

    def planner(state: DemoState) -> DemoState:
        return {"messages": [*state["messages"], "plan"]}

    def writer(state: DemoState) -> DemoState:
        return {"messages": [*state["messages"], "draft"]}

    builder = StateGraph(DemoState)
    builder.add_node("planner", planner)
    builder.add_node("writer", writer)
    builder.add_edge(START, "planner")
    builder.add_edge("planner", "writer")
    builder.add_edge("writer", END)
    graph = instrument_langgraph(builder.compile(), client=RecordingNexusClient(), run_id="real-lg")

    result = graph.invoke({"messages": ["hello"]}, config={"configurable": {"thread_id": "t1"}})

    assert result == {"messages": ["hello", "plan", "draft"]}

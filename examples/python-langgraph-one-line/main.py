from __future__ import annotations

import sys
from typing import TypedDict

from nexus_ipc import NexusClient
from nexus_ipc.adapters.langgraph import instrument_langgraph


try:
    from langgraph.graph import END, START, StateGraph
except ImportError:
    print("Install LangGraph with: py -m pip install langgraph")
    sys.exit(0)


class DemoState(TypedDict):
    messages: list[str]


def planner(state: DemoState) -> DemoState:
    return {"messages": [*state["messages"], "planner: outline the answer"]}


def researcher(state: DemoState) -> DemoState:
    return {"messages": [*state["messages"], "researcher: collect local facts"]}


def writer(state: DemoState) -> DemoState:
    return {"messages": [*state["messages"], "writer: draft the response"]}


def build_graph():
    builder = StateGraph(DemoState)
    builder.add_node("planner", planner)
    builder.add_node("researcher", researcher)
    builder.add_node("writer", writer)
    builder.add_edge(START, "planner")
    builder.add_edge("planner", "researcher")
    builder.add_edge("researcher", "writer")
    builder.add_edge("writer", END)
    return builder.compile()


def main() -> None:
    client = NexusClient.connect()
    graph = instrument_langgraph(
        build_graph(),
        client=client,
        run_id="langgraph-demo",
        agent_id="langgraph-demo-agent",
    )

    result = graph.invoke(
        {"messages": ["user: hello"]},
        config={"configurable": {"thread_id": "thread-1"}},
    )
    print("invoke result:")
    print(result)

    print("\nstream chunks:")
    for chunk in graph.stream(
        {"messages": ["user: stream hello"]},
        config={"configurable": {"thread_id": "thread-1"}},
    ):
        print(chunk)

    print("\nInspect captured LangGraph state:")
    print("cargo run -p nexus -- channels")
    print("cargo run -p nexus -- log --run langgraph-demo")


if __name__ == "__main__":
    main()

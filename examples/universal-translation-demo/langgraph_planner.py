from __future__ import annotations

import sys
from typing import TypedDict

from nexus_ipc import NexusClient
from nexus_ipc.adapters.langgraph import instrument_langgraph

RUN_ID = "universal-demo"
THREAD_ID = "main"


class PlannerState(TypedDict):
    messages: list[str]
    plan: list[str]


def build_langgraph():
    try:
        from langgraph.graph import END, START, StateGraph
    except ImportError:
        print("Install LangGraph with: py -m pip install langgraph")
        print("Skipping real LangGraph planner so the demo does not fake framework behavior.")
        sys.exit(0)

    def planner(state: PlannerState) -> PlannerState:
        return {
            "messages": [*state["messages"], "planner: publish a local research plan"],
            "plan": ["collect local facts", "summarize evidence", "draft frontend copy"],
        }

    builder = StateGraph(PlannerState)
    builder.add_node("planner", planner)
    builder.add_edge(START, "planner")
    builder.add_edge("planner", END)
    return builder.compile()


def main() -> None:
    client = NexusClient.connect()
    graph = instrument_langgraph(
        build_langgraph(),
        client=client,
        run_id=RUN_ID,
        agent_id="langgraph-planner",
        thread_id=THREAD_ID,
        tags=["universal-demo"],
    )
    result = graph.invoke(
        {"messages": ["user: coordinate three framework surfaces"], "plan": []},
        config={"configurable": {"thread_id": THREAD_ID}},
    )
    commit = client.checkpoint(
        agent_id="langgraph-planner",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        channel="topic:plan",
        state={"plan": result["plan"], "source": "langgraph"},
        summary="LangGraph planner published plan",
        tags=["universal-demo", "langgraph", "topic"],
    )
    print("LangGraph planner result:")
    print(result)
    print(f"topic:plan commit: {commit.commit_id}")


if __name__ == "__main__":
    main()

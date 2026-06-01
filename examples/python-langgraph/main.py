from nexus_ipc import NexusClient
from nexus_ipc.adapters.langgraph import wrap_node


def plan_node(state: dict[str, object]) -> dict[str, object]:
    return {**state, "plan": ["research", "draft"]}


def main() -> None:
    client = NexusClient.connect()
    client.register_agent(agent_id="langgraph-agent", run_id="langgraph-run", framework="langgraph")
    wrapped = wrap_node(client, "langgraph-agent", "langgraph-run", "plan", plan_node)
    print(wrapped({"objective": "write report"}))


if __name__ == "__main__":
    main()


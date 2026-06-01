from nexus_ipc import NexusClient


client = NexusClient.connect()
client.register_agent(agent_id="planner", run_id="multi-agent-demo", capabilities=["planning"])
commit = client.checkpoint(
    agent_id="planner",
    run_id="multi-agent-demo",
    channel="topic:plan",
    state={"plan": ["research revenue", "draft memo"]},
    summary="Planner created work plan",
    tags=["demo", "plan"],
)
print(commit.commit_id)


from nexus_ipc import NexusClient


client = NexusClient.connect()
client.register_agent(agent_id="writer", run_id="multi-agent-demo", capabilities=["drafting"])
commit = client.checkpoint(
    agent_id="writer",
    run_id="multi-agent-demo",
    channel="topic:draft",
    state={"draft": "Revenue increased 12 percent according to the annual report."},
    summary="Writer drafted finding",
    tags=["demo", "draft"],
)
print(commit.commit_id)


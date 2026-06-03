# nexus-ipc

Python SDK for Attow Nexus, the local coordination daemon and Git-like state ledger for polyglot agents.

```python
from nexus_ipc import NexusClient

client = NexusClient.connect()
client.register_agent(
    agent_id="researcher",
    run_id="run-123",
    capabilities=["web_research", "summarization"],
    framework="custom",
)

commit = client.checkpoint(
    agent_id="researcher",
    run_id="run-123",
    channel="topic:research",
    state={"finding": "Revenue increased"},
    summary="Added finding",
)
print(commit.commit_id)
```

The SDK redacts secrets before sending payloads to the daemon.

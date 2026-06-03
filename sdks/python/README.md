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

## LangGraph In Four Lines

```python
from nexus_ipc import NexusClient
from nexus_ipc.adapters.langgraph import instrument_langgraph

client = NexusClient.connect()
graph = instrument_langgraph(graph, client=client, run_id="my-run")

result = graph.invoke(input_state, config={"configurable": {"thread_id": "thread-1"}})
```

No LangGraph node imports `nexus_ipc`, and no state schema changes are required. The proxy preserves existing config/callbacks and captures invoke start/end, stream updates, async invoke/stream, errors, run/thread metadata, and chained Nexus commits for replay.

This is public-surface wrapper instrumentation around compiled graph methods. It does not replace LangGraph checkpointers and does not guarantee full per-node state unless LangGraph exposes that detail through public stream or callback events.

## CrewAI Wrapper

```python
from nexus_ipc import NexusClient
from nexus_ipc.adapters.crewai import instrument_crewai

client = NexusClient.connect()
crew = instrument_crewai(crew, client=client, run_id="my-run")
result = crew.kickoff(inputs={"topic": "local state"})
```

The proxy preserves `kickoff`, `kickoff_for_each`, and `kickoff_async` behavior where present. If a public `step_callback` exists, the adapter composes it instead of replacing user code.

## Universal Event Schema

LangGraph, CrewAI, and generic helpers translate framework-specific events into `UniversalAgentEvent` payloads. This keeps Attow Nexus as the neutral local bus and ledger underneath frameworks rather than a replacement framework.

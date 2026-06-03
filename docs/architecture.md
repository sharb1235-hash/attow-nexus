# Architecture

Attow Nexus has three layers: Nexus-IPC, NexusLedger, and Attow Nexus Console.

Nexus-IPC accepts local agent connections, validates auth and permissions, tracks presence, receives structured state deltas, and broadcasts matching updates to subscribers.

NexusLedger persists durable deltas as append-only commits in a content-addressed DAG. The hot path is the in-memory state bus and DAG index. The durable path is SQLite in WAL mode plus the artifact store.

Attow Nexus Console reads the daemon HTTP API and polls or streams updates through the SSE endpoint.

Ephemeral deltas are broadcast and cached as latest channel snapshots. They are not persisted unless `NEXUS_PERSIST_EPHEMERAL=true`. Durable deltas become commits before a durable acknowledgement is returned.

## Universal Translation Layer

Developer-preview framework adapters translate public framework lifecycle surfaces into a canonical `UniversalAgentEvent` schema before sending data to the daemon. That keeps Attow Nexus neutral: LangGraph, CrewAI, Vercel AI SDK, custom workers, and future adapters can all write to the same run/channel/commit model.

The canonical channel model is:

- `framework:{framework}:{run_id}` for framework-level run events.
- `events:{run_id}:{thread_id}` for stream, message, error, and step-start events.
- `state:{run_id}:{thread_id}` for checkpoint-like step/task/node end events.
- `topic:{topic_name}` for application-level handoff topics.

The v0.1 claim is not deep framework-native storage. It is one local daemon, one ledger, one CLI, and multiple framework surfaces feeding the same captured logical state history through public wrappers.

Local cluster mode is experimental. It uses a single-primary architecture: the primary owns durable ledger writes, while workers can accept local agents, broadcast local ephemeral deltas, and forward durable deltas to the primary.

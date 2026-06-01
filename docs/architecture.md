# Architecture

Nexus has three layers: Nexus-IPC, NexusLedger, and Nexus Console.

Nexus-IPC accepts local agent connections, validates auth and permissions, tracks presence, receives structured state deltas, and broadcasts matching updates to subscribers.

NexusLedger persists durable deltas as append-only commits in a content-addressed DAG. The hot path is the in-memory state bus and DAG index. The durable path is SQLite in WAL mode plus the artifact store.

Nexus Console reads the daemon HTTP API and polls or streams updates through the SSE endpoint.

Ephemeral deltas are broadcast and cached as latest channel snapshots. They are not persisted unless `NEXUS_PERSIST_EPHEMERAL=true`. Durable deltas become commits before a durable acknowledgement is returned.

Local cluster mode is experimental. It uses a single-primary architecture: the primary owns durable ledger writes, while workers can accept local agents, broadcast local ephemeral deltas, and forward durable deltas to the primary.


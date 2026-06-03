# Local Cluster

Local cluster mode is experimental.

The current implementation should be treated as descriptors/configuration and MVP scaffolding, not a verified distributed runtime. Durable forwarding behavior must be tested in your deployment before relying on it.

Attow Nexus uses a single-primary architecture. The primary owns durable ledger writes. Worker daemons accept local agent connections, broadcast local ephemeral deltas, and forward durable deltas to the primary. Durable commits are acknowledged only after the primary persists them.

There is no Raft or consensus in the MVP. Cluster TCP requires a shared token, and remote binding requires `NEXUS_ALLOW_REMOTE=true`.

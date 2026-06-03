# Attow Nexus Console

Attow Nexus Console is a local React dashboard for live observability.

Views include Home, Agent Bus, Channels, Ledger, Commit Detail, Diff, Replay, Fork, Rollback, Loop Warnings, and Metrics.

The dashboard uses the daemon HTTP API. It uses SSE for summary events and polling as a fallback for tables.

The console shows local-only status, auth status, daemon version, protocol version, ephemeral and durable labels, loop warning severity, rollback warnings, and copyable CLI commands.

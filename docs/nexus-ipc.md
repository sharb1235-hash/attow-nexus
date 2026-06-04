# Nexus-IPC

Nexus-IPC is the live coordination bus.

Channels use simple names such as `run:{run_id}`, `thread:{thread_id}`, `agent:{agent_id}`, `topic:{topic_name}`, `artifact:{artifact_id}`, `tool:{tool_name}`, `memory:{namespace}`, `system:presence`, and `system:loop_warnings`.

Publish/subscribe supports exact channel names and suffix wildcards such as `run:*` and `topic:research_*`.

Presence is updated through registration and heartbeats. Agents become stale or offline when heartbeat monitoring detects inactivity.

Each subscription uses a bounded queue. The default policy drops old ephemeral messages under pressure, while durable commit notices are sent through.

Permission scopes include channel read, write, checkpoint, ledger read, fork, rollback, and admin scopes.

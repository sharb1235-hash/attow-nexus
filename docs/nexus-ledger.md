# NexusLedger

NexusLedger stores durable deltas as commits.

Commits include commit ID, delta ID, run ID, thread ID, agent ID, channel, parents, logical clock, wall time, objective, state delta, messages delta, tool calls, tool results, artifact references, external side effects, summary, tags, metadata, schema version, SDK identity, content hash, previous hashes, and redaction report.

The DAG supports multiple roots, multiple parents, ancestry traversal, nearest common ancestor, fork semantics, and head pointers per run/thread/agent/channel.

Diff compares state keys, summaries, tags, tool calls, tool results, artifacts, side effects, and metadata.

Replay reconstructs captured logical state along the selected commit's ancestry. It does not merge all independent roots in a run unless parent links connect them. The default mode is `state_only`. `dry_run_tools` does not call external tools. `reexecute_tools` requires explicit confirmation.

Rollback moves a head pointer and creates a rollback marker event. History is not deleted.

External side effects are logged as irreversible unless an adapter provides a compensating action.

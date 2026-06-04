# Replay

Replay reconstructs captured logical state by following commit ancestry from the selected commit back to its connected root commits, then applying those commits in order.

Replay does not automatically merge every independent root in a run. If two commits share the same `run_id` but do not have parent links between them, replaying one commit reconstructs only that commit's ancestry path. Link commits with `parent_commit_ids` when the later state depends on earlier state.

Modes:

- `state_only`: default; reconstructs state without tool execution.
- `dry_run_tools`: includes tool plan information without calling external tools.
- `reexecute_tools`: requires explicit confirmation.

Replay output includes reconstructed state, messages, tool outputs, artifact references, side-effect warnings, provenance, and missing artifact warnings.

## Broken Agent Recovery

The `examples/broken-agent-recovery` demo uses replay for a deterministic local recovery story:

1. A planner commit captures the last good logical state.
2. A coder commit records an invalid config transition with `retry_limit: "five"`.
3. A reviewer commit records the validation failure.
4. A recovery commit is parented to the last good planner commit, not the bad commit.
5. A final reviewer commit validates the fixed recovered state.

This preserves both histories: the broken path remains auditable, while the recovery path resumes from captured logical state. Replay does not undo real file writes, emails, API calls, purchases, deployments, or database mutations unless an adapter provides a compensating action.

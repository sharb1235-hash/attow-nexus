# Replay

Replay reconstructs captured logical state by following commit ancestry from the selected commit back to its connected root commits, then applying those commits in order.

Replay does not automatically merge every independent root in a run. If two commits share the same `run_id` but do not have parent links between them, replaying one commit reconstructs only that commit's ancestry path. Link commits with `parent_commit_ids` when the later state depends on earlier state.

Modes:

- `state_only`: default; reconstructs state without tool execution.
- `dry_run_tools`: includes tool plan information without calling external tools.
- `reexecute_tools`: requires explicit confirmation.

Replay output includes reconstructed state, messages, tool outputs, artifact references, side-effect warnings, provenance, and missing artifact warnings.

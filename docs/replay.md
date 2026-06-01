# Replay

Replay reconstructs captured logical state from root commits to a selected commit.

Modes:

- `state_only`: default; reconstructs state without tool execution.
- `dry_run_tools`: includes tool plan information without calling external tools.
- `reexecute_tools`: requires explicit confirmation.

Replay output includes reconstructed state, messages, tool outputs, artifact references, side-effect warnings, provenance, and missing artifact warnings.


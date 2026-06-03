# Adapters

Adapters are public wrapper helpers for recording structured state deltas, checkpoints, tool calls, and errors. They are intentionally conservative: Attow Nexus does not monkeypatch private framework internals by default.

Use framework-native memory, checkpointers, callbacks, and orchestration where they already work well. Use Attow Nexus wrappers when state needs to cross frameworks, languages, runtimes, tools, or custom workers.

## Verification Status

| Adapter | Current status | Integration style | Verified against framework package |
| --- | --- | --- | --- |
| Generic Python | Working helper | Wrap callable agent steps and tools | N/A |
| Generic TypeScript | Working helper | Wrap async functions and tools | N/A |
| LangGraph Python | Early wrapper helper | User-called node/checkpoint helper using public app code boundaries | Not yet |
| CrewAI Python | Early wrapper helper | User-called crew/task helper using public app code boundaries | Not yet |
| AutoGen Python | Early wrapper helper | Middleware-style/user-called recorder | Not yet |
| Microsoft Agent Framework Python | Early wrapper helper | Middleware-style/user-called recorder | Not yet |
| LangGraph JS | Early wrapper helper | User-called node helper | Not yet |
| AutoGen JS | Early wrapper helper | Middleware-style/user-called recorder | Not yet |

## Guidance

- Prefer explicit wrappers around node functions, tasks, tools, callbacks, or middleware.
- Do not rely on private framework attributes or undocumented lifecycle methods.
- Keep framework-native persistence enabled when the framework needs it.
- Record external side effects as irreversible unless your application also supplies a compensating action.
- Treat the framework-specific helpers as examples until they are tested against pinned framework versions in CI.

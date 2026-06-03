# Adapters

Adapters are public wrapper helpers for recording structured state deltas, checkpoints, tool calls, and errors. They are intentionally conservative: Attow Nexus does not monkeypatch private framework internals by default.

Use framework-native memory, checkpointers, callbacks, and orchestration where they already work well. Use Attow Nexus wrappers when state needs to cross frameworks, languages, runtimes, tools, or custom workers.

## Verification Status

| Adapter | Current status | Integration style | Verified against framework package |
| --- | --- | --- | --- |
| Generic Python | Working helper | Wrap callable agent steps and tools | N/A |
| Generic TypeScript | Working helper | Wrap async functions and tools | N/A |
| LangGraph Python | Verified public-surface wrapper | Compiled graph proxy wrapping `invoke`, `ainvoke`, `stream`, `astream`, and `batch` where present | Fake compiled graph tests pass; optional real LangGraph smoke runs when `langgraph` is installed |
| CrewAI Python | Verified public-surface wrapper | Crew proxy wrapping `kickoff`, `kickoff_for_each`, `kickoff_async`, and public `step_callback` composition where present | Fake crew tests pass |
| Vercel AI SDK TypeScript | Verified public-surface wrapper | Wrap injected or dynamically loaded `generateText`; wrap injected `streamText` while preserving callbacks | Fake `generateText` and `streamText` tests pass; no `ai` dependency required for tests |
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

## Universal Translation Layer Demo

The v0.1 developer-preview claim is: one local daemon, one ledger, one CLI, three framework surfaces feeding the same run.

Attow Nexus normalizes framework events into a canonical `UniversalAgentEvent` schema. The adapters publish/checkpoint events through the same channel model:

- `framework:{framework}:{run_id}`
- `events:{run_id}:{thread_id}`
- `state:{run_id}:{thread_id}`
- `topic:{topic_name}`

The current adapters are public-surface wrappers. They do not require node pollution or state schema changes. Deep framework-specific checkpointer/store bridges are future work.

| Framework | Language | Adapter API | Verified level | Notes |
| --- | --- | --- | --- | --- |
| LangGraph | Python | `instrument_langgraph` | Verified wrapper with fake graph; optional real example if installed | No node changes |
| CrewAI | Python | `instrument_crewai` | Verified wrapper/fake crew; public `step_callback` support when available | No task changes |
| Vercel AI SDK | TypeScript | `instrumentStreamText` / `instrumentGenerateText` | Verified with fake `streamText` / `generateText` | Preserves callbacks |

## LangGraph

Preferred integration:

```python
from nexus_ipc import NexusClient
from nexus_ipc.adapters.langgraph import instrument_langgraph

client = NexusClient.connect()
graph = instrument_langgraph(graph, client=client, run_id="my-run")
result = graph.invoke(input_state, config={"configurable": {"thread_id": "thread-1"}})
```

What it captures today:

- `invoke` / `ainvoke` start and end.
- `stream` / `astream` updates, bounded to 100 captured stream events by default.
- Errors, which are checkpointed and re-raised.
- `run_id`, `agent_id`, `thread_id`, and canonical universal event metadata.
- Chained Nexus parent commit IDs inside a single graph execution.

What it does not yet do:

- It does not require node functions to import Nexus.
- It does not require state schema changes.
- It does not replace LangGraph checkpointers.
- It does not guarantee full per-node state unless LangGraph exposes it through public stream/callback events.
- It does not use private LangGraph internals.
- It does not synchronize remote cluster execution.

## CrewAI

Preferred integration:

```python
from nexus_ipc import NexusClient
from nexus_ipc.adapters.crewai import instrument_crewai

client = NexusClient.connect()
crew = instrument_crewai(crew, client=client, run_id="my-run")
result = crew.kickoff(inputs={"topic": "local state"})
```

The wrapper preserves the crew return value and composes a public `step_callback` if the object exposes one. It does not depend on private CrewAI internals and does not require task code to import Nexus.

## Vercel AI SDK

Preferred integration:

```ts
import { NexusClient } from "@nexus-ipc/sdk";
import { instrumentStreamText } from "@nexus-ipc/sdk/adapters/vercel-ai";
import { streamText as baseStreamText } from "ai";

const client = await NexusClient.connect();
const streamText = instrumentStreamText({
  client,
  runId: "frontend-run",
  baseStreamText,
});
```

The wrapper composes `onStepFinish`, `onFinish`, and `onError` callbacks. The SDK does not require the `ai` package for its tests or core install.

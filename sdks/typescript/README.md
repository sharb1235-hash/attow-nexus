# @nexus-ipc/sdk

TypeScript SDK for Attow Nexus, the local coordination daemon and Git-like state ledger for polyglot agents.

```ts
import { NexusClient } from "@nexus-ipc/sdk";

const client = await NexusClient.connect();
await client.registerAgent({
  agentId: "writer",
  runId: "run-123",
  capabilities: ["drafting"],
  framework: "custom",
});

const commit = await client.checkpoint({
  agentId: "writer",
  runId: "run-123",
  channel: "topic:draft",
  state: { section: "intro", done: true },
  summary: "Finished intro draft",
});
console.log(commit.commitId);
```

Payloads are redacted before they are sent to the daemon.

## Vercel AI SDK Wrapper

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

The wrapper composes `onStepFinish`, `onFinish`, and `onError` callbacks and emits canonical Attow Nexus events. The core SDK does not require the `ai` package; tests and the universal demo use injected fake functions.

## Universal Event Schema

TypeScript adapters use the same `UniversalAgentEvent` shape as the Python SDK so LangGraph, CrewAI, Vercel AI SDK, and custom workers can feed the same local run and ledger.

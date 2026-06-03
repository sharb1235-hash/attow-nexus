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

import { NexusClient } from "../../sdks/typescript/src/index";

const client = await NexusClient.connect();
await client.registerAgent({
  agentId: "researcher",
  runId: "multi-agent-demo",
  capabilities: ["research"],
  framework: "custom"
});

await client.checkpoint({
  agentId: "researcher",
  runId: "multi-agent-demo",
  channel: "topic:research",
  state: {
    claim: "Revenue increased 12 percent",
    source: "annual_report",
    confidence: 0.91
  },
  summary: "Researcher published revenue finding",
  tags: ["demo", "research"]
});

for (let i = 0; i < 3; i += 1) {
  await client.checkpoint({
    agentId: "researcher",
    runId: "multi-agent-demo",
    channel: "tool:web_search",
    state: { query: "same failing query", error_type: "RateLimitError" },
    summary: "Repeated tool failure",
    tags: ["demo", "loop"]
  });
}


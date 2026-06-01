import { NexusClient } from "@nexus-ipc/sdk";

const client = await NexusClient.connect();

await client.registerAgent({
  agentId: "ts-planner",
  runId: "typescript-demo-run",
  capabilities: ["planning"],
  framework: "custom"
});

const commit = await client.checkpoint({
  agentId: "ts-planner",
  runId: "typescript-demo-run",
  channel: "topic:plan",
  state: { steps: ["research", "draft"] },
  summary: "TypeScript planner published plan"
});

console.log("created commit", commit.commitId);

for await (const update of client.subscribe("topic:plan", 1000)) {
  console.log(update);
  break;
}


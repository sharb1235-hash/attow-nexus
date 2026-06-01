import { describe, expect, it } from "vitest";

import { NexusClient } from "../src/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("NexusClient", () => {
  it("registers an agent", async () => {
    const client = await NexusClient.connect({
      fetchImpl: async () => jsonResponse({ accepted: true, agentId: "writer" }),
    });
    const result = await client.registerAgent({ agentId: "writer", runId: "run-1" });
    expect(result.accepted).toBe(true);
  });

  it("publishes a delta", async () => {
    const client = await NexusClient.connect({
      fetchImpl: async () => jsonResponse({ deltaId: "d", commitId: "c", accepted: true, persisted: true }),
    });
    const result = await client.publishDelta({
      channel: "topic:research",
      agentId: "a",
      runId: "r",
      delta: { x: 1 },
      durable: true,
    });
    expect(result.persisted).toBe(true);
  });
});


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

  it("passes checkpoint parent commit ids", async () => {
    let body: Record<string, unknown> = {};
    const client = await NexusClient.connect({
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return jsonResponse({ deltaId: "d", commitId: "c", accepted: true, persisted: true });
      },
    });
    await client.checkpoint({
      agentId: "a",
      runId: "r",
      channel: "topic:research",
      state: { x: 1 },
      parentCommitIds: ["c_parent"],
    });
    expect(body.parent_commit_ids).toEqual(["c_parent"]);
  });

  it("sends bearer token authorization", async () => {
    let authorization = "";
    const client = await NexusClient.connect({
      token: "audit-token",
      fetchImpl: async (_url, init) => {
        authorization = String((init?.headers as Record<string, string>).authorization ?? "");
        return jsonResponse({ status: "ok" });
      },
    });
    await client.registerAgent({ agentId: "a", runId: "r" });
    expect(authorization).toBe("Bearer audit-token");
  });
});

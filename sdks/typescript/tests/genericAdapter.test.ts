import { describe, expect, it } from "vitest";

import { wrapAgentStep } from "../src/adapters/generic";
import { FakeNexusClient } from "../src/testing";

describe("generic adapter", () => {
  it("wraps async functions", async () => {
    const client = new FakeNexusClient();
    const wrapped = wrapAgentStep(
      client as never,
      { agentId: "a", runId: "r", channel: "topic:x" },
      async (state: { x: number }) => ({ x: state.x + 1 }),
    );
    await expect(wrapped({ x: 1 })).resolves.toEqual({ x: 2 });
    expect(client.events.at(-1)?.type).toBe("checkpoint");
  });
});


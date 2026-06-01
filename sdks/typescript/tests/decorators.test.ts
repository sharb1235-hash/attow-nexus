import { describe, expect, it } from "vitest";

import { checkpointStep } from "../src/decorators";
import { FakeNexusClient } from "../src/testing";

describe("checkpointStep", () => {
  it("records a checkpoint", async () => {
    const client = new FakeNexusClient();
    const step = checkpointStep(
      client as never,
      { agentId: "a", runId: "r", channel: "topic:x" },
      (state: { x: number }) => ({ x: state.x + 1 }),
    );
    await expect(step({ x: 1 })).resolves.toEqual({ x: 2 });
    expect(client.events.at(-1)?.type).toBe("checkpoint");
  });
});


import { describe, expect, it } from "vitest";

import {
  channelForEvent,
  defaultThreadId,
  eventToCheckpointPayload,
  normalizeEvent,
  safeJsonable,
  summarizePayload,
} from "../src/universal";

describe("universal event schema", () => {
  it("normalizes framework-neutral events and channel mapping", () => {
    const event = normalizeEvent({
      runId: "r",
      threadId: defaultThreadId("r", "vercel-ai"),
      agentId: "agent",
      framework: "vercel-ai",
      eventType: "step_end",
      output: { ok: true },
    });

    expect(event.threadId).toBe("r:main:vercel-ai");
    expect(channelForEvent(event)).toBe("state:r:r:main:vercel-ai");
    expect(event.channel).toBe("state:r:r:main:vercel-ai");
  });

  it("redacts and snake-cases checkpoint payloads", () => {
    const event = normalizeEvent({
      runId: "r",
      threadId: "t",
      agentId: "agent",
      framework: "vercel-ai",
      eventType: "custom",
      input: { password: "secret" },
    });

    const payload = eventToCheckpointPayload(event);

    expect(payload.event_type).toBe("custom");
    expect((payload.input as Record<string, unknown>).password).toBe("[REDACTED]");
  });

  it("summarizes non-json payloads", () => {
    expect(safeJsonable({ fn: () => undefined })).toEqual({ fn: "[function]" });
    expect(summarizePayload({ text: "a".repeat(700) })).toContain("...[truncated]");
  });
});

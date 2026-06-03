import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { channelForEvent, eventToCheckpointPayload, normalizeEvent } from "../src/universal";

const root = resolve(__dirname, "..", "..", "..");
const fixtureDir = resolve(root, "test-fixtures", "universal-events");
const goldenDir = resolve(root, "test-fixtures", "golden");
const validFixtures = readdirSync(fixtureDir)
  .filter((name) => name.endsWith(".json") && !name.startsWith("malformed-"))
  .sort();
const malformedFixtures = readdirSync(fixtureDir)
  .filter((name) => name.startsWith("malformed-"))
  .sort();
const goldenFixtures = new Map([
  ["langgraph-run-start.json", "langgraph-run-start.normalized.json"],
  ["crewai-task-end.json", "crewai-task-end.normalized.json"],
  ["vercel-step-finish.json", "vercel-step-finish.normalized.json"],
  ["error-event.json", "error-event.normalized.json"],
  ["redaction-event.json", "redaction-event.normalized.json"],
  ["parent-chain-child.json", "parent-chain-child.normalized.json"],
]);

describe("universal event fixtures", () => {
  for (const fixtureName of validFixtures) {
    it(`normalizes ${fixtureName}`, () => {
      const data = readFixture(fixtureName);
      const event = normalizeEvent(data);
      const payload = eventToCheckpointPayload(event);

      expect(payload.schema_version).toBe("nexus.universal.v1");
      expect(payload.event_id).toBe(data.event_id);
      expect(payload.run_id).toBe(data.run_id);
      expect(payload.thread_id).toBe(data.thread_id);
      expect(payload.agent_id).toBe(data.agent_id);
      expect(payload.framework).toBe(data.framework);
      expect(payload.event_type).toBe(data.event_type);
      expect(channelForEvent(event)).toBe(data.channel);
      expect(Array.isArray(payload.parent_commit_ids)).toBe(true);
      expect((payload.parent_commit_ids as unknown[]).every((parent) => typeof parent === "string")).toBe(true);
      expect(Number.isInteger(payload.timestamp_ms)).toBe(true);
    });
  }

  for (const [fixtureName, goldenName] of goldenFixtures.entries()) {
    it(`matches golden output for ${fixtureName}`, () => {
      const event = normalizeEvent(readFixture(fixtureName));
      expect(canonical(eventToCheckpointPayload(event))).toBe(readGolden(goldenName));
    });
  }

  it("redacts the redaction fixture", () => {
    const payload = eventToCheckpointPayload(normalizeEvent(readFixture("redaction-event.json")));
    const text = JSON.stringify(payload);

    expect(text).not.toContain("sk-testsecretvalue");
    expect(text).not.toContain("secret-token-value");
    expect(text).not.toContain("correct horse");
    expect((payload.input as Record<string, unknown>).api_key).toBe("[REDACTED]");
    expect(((payload.input as Record<string, unknown>).headers as Record<string, unknown>).Authorization).toBe(
      "[REDACTED]",
    );
    expect((payload.input as Record<string, unknown>).password).toBe("[REDACTED]");
  });

  it("accepts camelCase API input and serializes canonical snake_case", () => {
    const payload = eventToCheckpointPayload(
      normalizeEvent({
        eventId: "evt_camel",
        runId: "contract-fixture-demo",
        threadId: "main",
        agentId: "vercel-ai-frontend",
        framework: "vercel-ai",
        language: "typescript",
        eventType: "step_end",
        stepName: "generateText",
        timestampMs: 1780476123000,
      }),
    );

    expect(payload.event_id).toBe("evt_camel");
    expect(payload.eventId).toBeUndefined();
    expect(payload.step_name).toBe("generateText");
  });

  for (const fixtureName of malformedFixtures) {
    it(`rejects ${fixtureName}`, () => {
      expect(() => normalizeEvent(readFixture(fixtureName))).toThrow();
    });
  }
});

function readFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), "utf8")) as Record<string, unknown>;
}

function readGolden(name: string): string {
  return readFileSync(resolve(goldenDir, name), "utf8").trim();
}

function canonical(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortDeep(child)]),
    );
  }
  return value;
}

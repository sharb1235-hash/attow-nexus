import { describe, expect, it } from "vitest";

import { instrumentGenerateText, instrumentStreamText } from "../src/adapters/vercel-ai";
import { FakeNexusClient } from "../src/testing";

const checkpoints = (client: FakeNexusClient) => client.events.filter((event) => event.type === "checkpoint");

describe("Vercel AI SDK adapter", () => {
  it("wraps generateText, preserves callbacks, and returns the base result", async () => {
    const client = new FakeNexusClient();
    const callbackCalls: unknown[] = [];
    const generateText = instrumentGenerateText({
      client: client as never,
      runId: "run-1",
      baseGenerateText: async (options: Record<string, unknown>) => {
        await (options.onStepFinish as (step: unknown) => Promise<void>)({ step: 1 });
        return { text: "done" };
      },
    });

    const result = await generateText({
      messages: [{ role: "user", content: "hello" }],
      onStepFinish: (step: unknown) => callbackCalls.push(step),
    });

    expect(result).toEqual({ text: "done" });
    expect(callbackCalls).toEqual([{ step: 1 }]);
    expect(checkpoints(client).map((event) => (event.state as Record<string, unknown>).event_type)).toEqual([
      "run_start",
      "step_end",
      "run_end",
    ]);
  });

  it("wraps streamText, composes onFinish, and preserves sync return value", async () => {
    const client = new FakeNexusClient();
    const finishCalls: unknown[] = [];
    const streamText = instrumentStreamText({
      client: client as never,
      runId: "run-1",
      baseStreamText: (options: Record<string, unknown>) => {
        void (options.onFinish as (result: unknown) => Promise<void>)({ text: "streamed" });
        return { textStream: ["a", "b"] };
      },
    });

    const result = streamText({
      onFinish: (finish: unknown) => finishCalls.push(finish),
    });
    await flushAsyncCallbacks();

    expect(result).toEqual({ textStream: ["a", "b"] });
    expect(finishCalls).toEqual([{ text: "streamed" }]);
    expect(checkpoints(client).map((event) => (event.state as Record<string, unknown>).event_type)).toContain(
      "run_end",
    );
  });

  it("checkpoints callback errors while preserving user onError", async () => {
    const client = new FakeNexusClient();
    const errorCalls: unknown[] = [];
    const streamText = instrumentStreamText({
      client: client as never,
      runId: "run-1",
      baseStreamText: (options: Record<string, unknown>) => {
        void (options.onError as (error: unknown) => Promise<void>)(new Error("model failed"));
        return { ok: false };
      },
    });

    streamText({ onError: (error: unknown) => errorCalls.push(error) });
    await flushAsyncCallbacks();

    expect(errorCalls[0]).toBeInstanceOf(Error);
    expect(checkpoints(client).map((event) => (event.state as Record<string, unknown>).event_type)).toContain(
      "error",
    );
  });
});

function flushAsyncCallbacks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

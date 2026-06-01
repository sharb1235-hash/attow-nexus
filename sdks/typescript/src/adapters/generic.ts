import { NexusClient } from "../client";

export function wrapAgentStep<TState extends Record<string, unknown>, TResult>(
  client: NexusClient,
  options: { agentId: string; runId: string; channel: string },
  step: (state: TState) => Promise<TResult> | TResult,
): (state: TState) => Promise<TResult> {
  return async (state: TState) => {
    await client.publishDelta({
      channel: options.channel,
      agentId: options.agentId,
      runId: options.runId,
      delta: { phase: "input", state },
      durable: false,
    });
    try {
      const result = await step(state);
      await client.checkpoint({
        agentId: options.agentId,
        runId: options.runId,
        channel: options.channel,
        state: typeof result === "object" && result !== null ? (result as Record<string, unknown>) : { result },
        summary: "Wrapped agent step completed",
      });
      return result;
    } catch (error) {
      await client.checkpoint({
        agentId: options.agentId,
        runId: options.runId,
        channel: options.channel,
        state: { error: error instanceof Error ? error.name : "Error" },
        summary: "Wrapped agent step failed",
      });
      throw error;
    }
  };
}


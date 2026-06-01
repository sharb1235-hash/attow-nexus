import { NexusClient } from "./client";

export function checkpointStep<TState extends Record<string, unknown>, TResult>(
  client: NexusClient,
  options: { agentId: string; runId: string; channel: string; summary?: string },
  step: (state: TState) => Promise<TResult> | TResult,
): (state: TState) => Promise<TResult> {
  return async (state: TState) => {
    const result = await step(state);
    const output = typeof result === "object" && result !== null ? (result as Record<string, unknown>) : { result };
    await client.checkpoint({
      agentId: options.agentId,
      runId: options.runId,
      channel: options.channel,
      state: output,
      summary: options.summary ?? "Checkpointed wrapped step",
    });
    return result;
  };
}

export function wrapTool<TArgs extends unknown[], TResult>(
  client: NexusClient,
  options: { name: string; agentId: string; runId: string; channel?: string },
  tool: (...args: TArgs) => Promise<TResult> | TResult,
): (...args: TArgs) => Promise<TResult> {
  const channel = options.channel ?? `tool:${options.name}`;
  return async (...args: TArgs) => {
    await client.publishDelta({
      channel,
      agentId: options.agentId,
      runId: options.runId,
      delta: { tool: options.name, phase: "started" },
      durable: false,
    });
    try {
      const result = await tool(...args);
      await client.checkpoint({
        agentId: options.agentId,
        runId: options.runId,
        channel,
        state: { tool: options.name, result },
        summary: `Tool ${options.name} finished`,
      });
      return result;
    } catch (error) {
      await client.checkpoint({
        agentId: options.agentId,
        runId: options.runId,
        channel,
        state: { tool: options.name, error: error instanceof Error ? error.name : "Error" },
        summary: `Tool ${options.name} failed`,
      });
      throw error;
    }
  };
}


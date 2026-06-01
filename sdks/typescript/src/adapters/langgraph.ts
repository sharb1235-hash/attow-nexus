import { NexusClient } from "../client";

export function wrapLangGraphNode<TState extends Record<string, unknown>>(
  client: NexusClient,
  options: { agentId: string; runId: string; nodeName: string },
  node: (state: TState) => Promise<TState> | TState,
): (state: TState) => Promise<TState> {
  return async (state: TState) => {
    const result = await node(state);
    await client.checkpoint({
      agentId: options.agentId,
      runId: options.runId,
      channel: `topic:langgraph_${options.nodeName}`,
      state: { node: options.nodeName, state: result },
      summary: `LangGraph JS node ${options.nodeName} transition`,
      tags: ["langgraph", "node"],
    });
    return result;
  };
}


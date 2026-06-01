import { NexusClient } from "../client";

export async function recordAutoGenMessage(
  client: NexusClient,
  input: { agentId: string; runId: string; channel: string; sender: string; content: string },
): Promise<void> {
  await client.publishDelta({
    channel: input.channel,
    agentId: input.agentId,
    runId: input.runId,
    delta: { sender: input.sender, content: input.content },
    durable: true,
    tags: ["autogen", "message"],
  });
}


import { NexusClient } from "@nexus-ipc/sdk";
import { instrumentGenerateText, instrumentStreamText } from "@nexus-ipc/sdk/adapters/vercel-ai";

const runId = "universal-demo";
const threadId = "main";

async function main() {
  const client = await NexusClient.connect();

  const generateText = instrumentGenerateText({
    client,
    runId,
    threadId,
    agentId: "vercel-ai-frontend",
    baseGenerateText: async (options: Record<string, unknown>) => {
      await (options.onStepFinish as (step: unknown) => Promise<void>)({
        stepType: "fake-generate",
        text: "prepared frontend summary",
      });
      return { text: "Frontend copy: local bus, one ledger, three framework surfaces." };
    },
    tags: ["universal-demo"],
  });

  const streamText = instrumentStreamText({
    client,
    runId,
    threadId,
    agentId: "vercel-ai-frontend",
    baseStreamText: (options: Record<string, unknown>) => {
      void (options.onStepFinish as (step: unknown) => Promise<void>)({
        stepType: "fake-stream",
        text: "streaming local copy",
      });
      void (options.onFinish as (result: unknown) => Promise<void>)({
        text: "Stream finished without cloud calls.",
      });
      return { textStream: ["local ", "state ", "bus"] };
    },
    tags: ["universal-demo"],
  });

  const generated = await generateText({
    messages: [{ role: "user", content: "Summarize the universal demo." }],
  });
  const streamed = streamText({
    messages: [{ role: "user", content: "Stream a local UI note." }],
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  const parent = await latestCommitForChannel("topic:research");

  const commit = await client.checkpoint({
    agentId: "vercel-ai-frontend",
    runId,
    threadId,
    channel: "topic:frontend",
    state: { generated, streamed, source: "vercel-ai" },
    summary: "Vercel AI frontend agent published frontend copy",
    tags: ["universal-demo", "vercel-ai", "topic"],
    parentCommitIds: parent ? [parent] : [],
  });

  console.log("Vercel AI frontend result:");
  console.log({ generated, streamed });
  console.log(`topic:frontend commit: ${commit.commitId}`);
}

async function latestCommitForChannel(channel: string): Promise<string | undefined> {
  const response = await fetch(`http://127.0.0.1:7822/api/runs/${runId}/commits`);
  if (!response.ok) {
    return undefined;
  }
  const commits = (await response.json()) as Array<Record<string, unknown>>;
  const matching = commits.filter((commit) => commit.channel === channel);
  return matching.at(-1)?.commitId as string | undefined;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

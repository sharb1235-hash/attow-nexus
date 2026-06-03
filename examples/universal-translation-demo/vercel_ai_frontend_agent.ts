import { NexusClient } from "../../sdks/typescript/src/client";
import { instrumentGenerateText, instrumentStreamText } from "../../sdks/typescript/src/adapters/vercel-ai";

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

  const commit = await client.checkpoint({
    agentId: "vercel-ai-frontend",
    runId,
    threadId,
    channel: "topic:frontend",
    state: { generated, streamed, source: "vercel-ai" },
    summary: "Vercel AI frontend agent published frontend copy",
    tags: ["universal-demo", "vercel-ai", "topic"],
  });

  console.log("Vercel AI frontend result:");
  console.log({ generated, streamed });
  console.log(`topic:frontend commit: ${commit.commitId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

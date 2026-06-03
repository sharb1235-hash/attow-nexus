import { NexusClient } from "../client";
import { createNexusAdapterContext } from "./base";

type Callback = (options: Record<string, unknown>) => unknown;
type UserCallback = (value: unknown) => unknown;

export interface NexusAISDKAdapterOptions {
  client: NexusClient;
  runId: string;
  threadId?: string;
  agentId?: string;
  baseGenerateText?: Callback;
  baseStreamText?: Callback;
  captureInputs?: boolean;
  captureOutputs?: boolean;
  captureStreamDeltas?: boolean;
  failOpen?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function createNexusAIEventAdapter(options: NexusAISDKAdapterOptions) {
  return createNexusAdapterContext({
    client: options.client,
    runId: options.runId,
    threadId: options.threadId,
    agentId: options.agentId ?? "vercel-ai-frontend",
    frameworkName: "vercel-ai",
    failOpen: options.failOpen,
    tags: options.tags,
    metadata: options.metadata,
  });
}

export function instrumentGenerateText(options: NexusAISDKAdapterOptions) {
  const context = createNexusAIEventAdapter(options);
  return async function generateTextWithNexus(inputOptions: Record<string, unknown> = {}) {
    const threadId = context.deriveThreadId(optionalString(inputOptions.threadId ?? inputOptions.thread_id));
    await context.checkpointEvent(
      context.event("run_start", {
        threadId,
        stepName: "generateText",
        input: options.captureInputs === false ? "[not captured]" : boundedOptions(inputOptions),
      }),
    );
    const baseGenerateText = options.baseGenerateText ?? (await loadAIFunction("generateText"));
    const wrappedOptions = composeCallbacks(inputOptions, context, threadId, "generateText", options);
    try {
      const result = await baseGenerateText(wrappedOptions);
      await context.checkpointEvent(
        context.event("run_end", {
          threadId,
          stepName: "generateText",
          output: options.captureOutputs === false ? "[not captured]" : result,
        }),
      );
      return result;
    } catch (error) {
      await context.checkpointEvent(errorEvent(context, threadId, "generateText", error));
      throw error;
    }
  };
}

export function instrumentStreamText(options: NexusAISDKAdapterOptions) {
  const context = createNexusAIEventAdapter(options);
  return function streamTextWithNexus(inputOptions: Record<string, unknown> = {}) {
    const threadId = context.deriveThreadId(optionalString(inputOptions.threadId ?? inputOptions.thread_id));
    void context.checkpointEvent(
      context.event("run_start", {
        threadId,
        stepName: "streamText",
        input: options.captureInputs === false ? "[not captured]" : boundedOptions(inputOptions),
      }),
    );
    const wrappedOptions = composeCallbacks(inputOptions, context, threadId, "streamText", options);
    try {
      const baseStreamText = options.baseStreamText ?? missingStreamText();
      return baseStreamText(wrappedOptions);
    } catch (error) {
      void context.checkpointEvent(errorEvent(context, threadId, "streamText", error));
      throw error;
    }
  };
}

export const withNexusAISDK = instrumentStreamText;

function composeCallbacks(
  inputOptions: Record<string, unknown>,
  context: ReturnType<typeof createNexusAIEventAdapter>,
  threadId: string,
  stepName: string,
  options: NexusAISDKAdapterOptions,
): Record<string, unknown> {
  const originalOnStepFinish = inputOptions.onStepFinish as UserCallback | undefined;
  const originalOnFinish = inputOptions.onFinish as UserCallback | undefined;
  const originalOnError = inputOptions.onError as UserCallback | undefined;
  return {
    ...inputOptions,
    async onStepFinish(step: unknown) {
      const originalResult = originalOnStepFinish?.(step);
      await context.checkpointEvent(
        context.event("step_end", {
          threadId,
          stepName,
          output: options.captureOutputs === false ? "[not captured]" : step,
        }),
      );
      return originalResult;
    },
    async onFinish(result: unknown) {
      const originalResult = originalOnFinish?.(result);
      await context.checkpointEvent(
        context.event("run_end", {
          threadId,
          stepName,
          output: options.captureOutputs === false ? "[not captured]" : result,
        }),
      );
      return originalResult;
    },
    async onError(error: unknown) {
      const originalResult = originalOnError?.(error);
      await context.checkpointEvent(errorEvent(context, threadId, stepName, error));
      return originalResult;
    },
  };
}

function errorEvent(context: ReturnType<typeof createNexusAIEventAdapter>, threadId: string, stepName: string, error: unknown) {
  return context.event("error", {
    threadId,
    stepName,
    error: {
      type: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

function boundedOptions(inputOptions: Record<string, unknown>): Record<string, unknown> {
  const { model: _model, onStepFinish: _onStepFinish, onFinish: _onFinish, onError: _onError, ...rest } = inputOptions;
  return rest;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

async function loadAIFunction(name: "generateText"): Promise<Callback> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<Record<string, unknown>>;
    const module = await dynamicImport("ai");
    const fn = module[name];
    if (typeof fn === "function") {
      return fn as Callback;
    }
  } catch {
    // Fall through to clear adapter error.
  }
  throw new Error(
    "Install the Vercel AI SDK with `npm install ai` or pass baseGenerateText/baseStreamText to the Attow Nexus adapter.",
  );
}

function missingStreamText(): Callback {
  throw new Error(
    "Pass baseStreamText to instrumentStreamText or install/use the Vercel AI SDK streamText function explicitly.",
  );
}

import { NexusClient } from "../client";
import { DeltaResult } from "../models";
import {
  UniversalAgentEvent,
  UniversalEventType,
  defaultThreadId,
  eventToCheckpointPayload,
  normalizeEvent,
} from "../universal";

export interface NexusAdapterContextOptions {
  client: NexusClient;
  runId: string;
  agentId: string;
  frameworkName: string;
  threadId?: string;
  durable?: boolean;
  failOpen?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface NexusAdapterContext {
  frameworkName: string;
  register(threadId?: string): Promise<void>;
  publishEvent(event: UniversalAgentEvent): Promise<void>;
  checkpointEvent(event: UniversalAgentEvent): Promise<string[]>;
  deriveThreadId(threadId?: string): string;
  event(eventType: UniversalEventType, input?: Partial<UniversalAgentEvent>): UniversalAgentEvent;
  close(): Promise<void>;
}

export function createNexusAdapterContext(options: NexusAdapterContextOptions): NexusAdapterContext {
  const registeredThreads = new Set<string>();
  const lastCommitByThread = new Map<string, string>();
  const failOpen = options.failOpen ?? true;
  const tags = [options.frameworkName, ...(options.tags ?? [])];
  const metadata = { ...(options.metadata ?? {}) };

  async function call<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      if (!failOpen) {
        throw error;
      }
      console.warn(`Attow Nexus ${options.frameworkName} adapter call failed: ${String(error)}`);
      return undefined;
    }
  }

  const context: NexusAdapterContext = {
    frameworkName: options.frameworkName,
    deriveThreadId(threadId?: string): string {
      return threadId ?? options.threadId ?? defaultThreadId(options.runId, options.frameworkName);
    },
    async register(threadId?: string): Promise<void> {
      const resolvedThreadId = context.deriveThreadId(threadId);
      if (registeredThreads.has(resolvedThreadId)) {
        return;
      }
      await call(() =>
        options.client.registerAgent({
          agentId: options.agentId,
          runId: options.runId,
          threadId: resolvedThreadId,
          framework: options.frameworkName,
          language: "typescript",
          capabilities: [options.frameworkName, "universal-events"],
          metadata: Object.fromEntries(
            Object.entries({ ...metadata, adapter: "public-surface-wrapper" }).map(([key, value]) => [
              key,
              String(value),
            ]),
          ),
        }),
      );
      registeredThreads.add(resolvedThreadId);
    },
    async publishEvent(event: UniversalAgentEvent): Promise<void> {
      await context.register(event.threadId);
      await call(() =>
        options.client.publishDelta({
          channel: event.channel,
          agentId: options.agentId,
          runId: options.runId,
          threadId: event.threadId,
          delta: eventToCheckpointPayload(event),
          durable: false,
          summary: `${options.frameworkName} ${event.eventType}`,
          tags: [...tags, event.eventType],
          metadata: { universal_event: "true" },
        }),
      );
    },
    async checkpointEvent(event: UniversalAgentEvent): Promise<string[]> {
      await context.register(event.threadId);
      if (event.parentCommitIds.length === 0 && lastCommitByThread.has(event.threadId)) {
        event.parentCommitIds = [lastCommitByThread.get(event.threadId) as string];
      }
      const result = await call<DeltaResult>(() =>
        options.client.checkpoint({
          channel: event.channel,
          agentId: options.agentId,
          runId: options.runId,
          threadId: event.threadId,
          state: eventToCheckpointPayload(event),
          summary: `${options.frameworkName} ${event.eventType}`,
          tags: [...tags, event.eventType, ...event.tags],
          metadata: { universal_event: "true" },
          parentCommitIds: event.parentCommitIds,
        }),
      );
      if (result?.commitId) {
        lastCommitByThread.set(event.threadId, result.commitId);
        return [result.commitId];
      }
      return event.parentCommitIds;
    },
    event(eventType: UniversalEventType, input: Partial<UniversalAgentEvent> = {}): UniversalAgentEvent {
      const threadId = context.deriveThreadId(input.threadId);
      const parentCommitId = lastCommitByThread.get(threadId);
      return normalizeEvent({
        adapterName: options.frameworkName,
        adapterVersion: String(metadata.adapter_version ?? "0.1.0"),
        runId: options.runId,
        threadId,
        agentId: options.agentId,
        framework: options.frameworkName,
        language: "typescript",
        eventType,
        metadata: { ...metadata, ...(input.metadata ?? {}) },
        tags: [...tags, ...(input.tags ?? [])],
        parentCommitIds: input.parentCommitIds ?? (parentCommitId ? [parentCommitId] : []),
        ...input,
      });
    },
    async close(): Promise<void> {
      return undefined;
    },
  };

  return context;
}

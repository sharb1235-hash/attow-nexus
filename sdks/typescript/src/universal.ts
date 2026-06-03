import { z } from "zod";

import { redact } from "./redaction";

export const universalEventTypeSchema = z.enum([
  "run_start",
  "run_end",
  "step_start",
  "step_end",
  "node_start",
  "node_end",
  "task_start",
  "task_end",
  "tool_start",
  "tool_end",
  "stream_delta",
  "message_delta",
  "state_checkpoint",
  "error",
  "custom",
]);

export type UniversalEventType = z.infer<typeof universalEventTypeSchema>;

export interface UniversalAgentEvent {
  eventId: string;
  runId: string;
  threadId: string;
  agentId: string;
  framework: string;
  frameworkVersion?: string;
  language: string;
  eventType: UniversalEventType;
  channel: string;
  stepName?: string;
  nodeName?: string;
  taskName?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  delta?: unknown;
  messages?: unknown[];
  error?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  tags: string[];
  parentCommitIds: string[];
  timestampMs: number;
}

export function defaultThreadId(runId: string, framework: string): string {
  return `${runId}:main:${framework}`;
}

export function channelForEvent(event: Pick<UniversalAgentEvent, "channel" | "eventType" | "runId" | "threadId" | "framework" | "toolName">): string {
  if (event.channel) {
    return event.channel;
  }
  if (event.toolName) {
    return `tool:${event.runId}:${event.toolName}`;
  }
  if (event.eventType === "run_start" || event.eventType === "run_end") {
    return `framework:${event.framework}:${event.runId}`;
  }
  if (["step_end", "node_end", "task_end", "state_checkpoint"].includes(event.eventType)) {
    return `state:${event.runId}:${event.threadId}`;
  }
  return `events:${event.runId}:${event.threadId}`;
}

export function normalizeEvent(input: {
  runId: string;
  threadId: string;
  agentId: string;
  framework: string;
  frameworkVersion?: string;
  language?: string;
  eventType: UniversalEventType;
  channel?: string;
  stepName?: string;
  nodeName?: string;
  taskName?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  delta?: unknown;
  messages?: unknown[];
  error?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  parentCommitIds?: string[];
  timestampMs?: number;
}): UniversalAgentEvent {
  const event: UniversalAgentEvent = {
    eventId: `evt_${cryptoSafeId()}`,
    language: "typescript",
    channel: "",
    metadata: {},
    tags: [],
    parentCommitIds: [],
    timestampMs: Date.now(),
    ...input,
  };
  event.channel = channelForEvent(event);
  return event;
}

export function safeJsonable(value: unknown, maxStringChars = 4000): unknown {
  if (typeof value === "string") {
    return value.length <= maxStringChars ? value : `${value.slice(0, maxStringChars)}...[truncated]`;
  }
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => safeJsonable(item, maxStringChars));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      output[key] = safeJsonable(child, maxStringChars);
    }
    return output;
  }
  if (typeof value === "function") {
    return "[function]";
  }
  return String(value);
}

export function summarizePayload(value: unknown, maxChars = 500): string {
  const text = JSON.stringify(safeJsonable(value));
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...[truncated]`;
}

export function redactEvent(event: UniversalAgentEvent): UniversalAgentEvent {
  const redacted = redact(event).value;
  return redacted as UniversalAgentEvent;
}

export function eventToCheckpointPayload(event: UniversalAgentEvent): Record<string, unknown> {
  return toSnakeCase(redactEvent(event)) as Record<string, unknown>;
}

function cryptoSafeId(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function toSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toSnakeCase);
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = toSnakeCase(child);
    }
    return output;
  }
  return value;
}

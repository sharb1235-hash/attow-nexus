import { redact } from "./redaction";

export const universalEventTypes = [
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
] as const;

export type UniversalEventType = (typeof universalEventTypes)[number];

const allowedFrameworks = new Set([
  "autogen",
  "crewai",
  "custom",
  "generic",
  "langgraph",
  "microsoft-agent-framework",
  "vercel-ai",
]);
const channelRe = /^[a-z][a-z0-9_]*:[A-Za-z0-9_.:\-*]+$/;
const idRe = /^[A-Za-z0-9_.:\-]+$/;

export interface UniversalAgentEvent {
  schemaVersion: string;
  sdkName: string;
  sdkVersion: string;
  adapterName: string;
  adapterVersion: string;
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

export type UniversalAgentEventInput = Partial<UniversalAgentEvent> & Record<string, unknown>;

export function defaultThreadId(runId: string, framework: string): string {
  return `${runId}:main:${framework}`;
}

export function channelForEvent(
  event: Pick<UniversalAgentEvent, "channel" | "eventType" | "runId" | "threadId" | "framework" | "toolName">,
): string {
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

export function normalizeEvent(input: UniversalAgentEventInput): UniversalAgentEvent {
  const event: UniversalAgentEvent = {
    schemaVersion: stringValue(input.schemaVersion ?? input.schema_version, "schema_version", "nexus.universal.v1"),
    sdkName: stringValue(input.sdkName ?? input.sdk_name, "sdk_name", "@nexus-ipc/sdk"),
    sdkVersion: stringValue(input.sdkVersion ?? input.sdk_version, "sdk_version", "0.1.0"),
    adapterName: stringValue(input.adapterName ?? input.adapter_name, "adapter_name", "generic"),
    adapterVersion: stringValue(input.adapterVersion ?? input.adapter_version, "adapter_version", "0.1.0"),
    eventId: stringValue(input.eventId ?? input.event_id, "event_id", `evt_${randomId()}`),
    runId: stringValue(input.runId ?? input.run_id, "run_id"),
    threadId: stringValue(input.threadId ?? input.thread_id, "thread_id"),
    agentId: stringValue(input.agentId ?? input.agent_id, "agent_id"),
    framework: stringValue(input.framework, "framework"),
    frameworkVersion: optionalString(input.frameworkVersion ?? input.framework_version),
    language: stringValue(input.language, "language", "typescript"),
    eventType: eventTypeValue(input.eventType ?? input.event_type),
    channel: optionalString(input.channel) ?? "",
    stepName: optionalString(input.stepName ?? input.step_name),
    nodeName: optionalString(input.nodeName ?? input.node_name),
    taskName: optionalString(input.taskName ?? input.task_name),
    toolName: optionalString(input.toolName ?? input.tool_name),
    input: input.input,
    output: input.output,
    delta: input.delta,
    messages: optionalMessages(input.messages),
    error: optionalRecord(input.error, "error"),
    metadata: recordValue(input.metadata, "metadata", {}),
    tags: stringArray(input.tags, "tags", []),
    parentCommitIds: stringArray(input.parentCommitIds ?? input.parent_commit_ids, "parent_commit_ids", []),
    timestampMs: integerValue(input.timestampMs ?? input.timestamp_ms, "timestamp_ms", Date.now()),
  };
  event.channel = channelForEvent(event);
  validateEvent(event);
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
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
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
  return redact(event).value as UniversalAgentEvent;
}

export function eventToCheckpointPayload(event: UniversalAgentEvent): Record<string, unknown> {
  const clean = redactEvent(event);
  const payload: Record<string, unknown> = {
    schema_version: clean.schemaVersion,
    sdk_name: clean.sdkName,
    sdk_version: clean.sdkVersion,
    adapter_name: clean.adapterName,
    adapter_version: clean.adapterVersion,
    event_id: clean.eventId,
    run_id: clean.runId,
    thread_id: clean.threadId,
    agent_id: clean.agentId,
    framework: clean.framework,
    language: clean.language,
    event_type: clean.eventType,
    channel: clean.channel,
    metadata: clean.metadata,
    tags: clean.tags,
    parent_commit_ids: clean.parentCommitIds,
    timestamp_ms: clean.timestampMs,
  };
  if (clean.frameworkVersion !== undefined) payload.framework_version = clean.frameworkVersion;
  if (clean.stepName !== undefined) payload.step_name = clean.stepName;
  if (clean.nodeName !== undefined) payload.node_name = clean.nodeName;
  if (clean.taskName !== undefined) payload.task_name = clean.taskName;
  if (clean.toolName !== undefined) payload.tool_name = clean.toolName;
  if (clean.input !== undefined) payload.input = clean.input;
  if (clean.output !== undefined) payload.output = clean.output;
  if (clean.delta !== undefined) payload.delta = clean.delta;
  if (clean.messages !== undefined) payload.messages = clean.messages;
  if (clean.error !== undefined) payload.error = clean.error;
  return payload;
}

function validateEvent(event: UniversalAgentEvent): void {
  if (event.schemaVersion !== "nexus.universal.v1") {
    throw new Error("UniversalAgentEvent.schema_version must be nexus.universal.v1");
  }
  for (const [field, value] of [
    ["event_id", event.eventId],
    ["run_id", event.runId],
    ["thread_id", event.threadId],
    ["agent_id", event.agentId],
  ]) {
    if (!value) {
      throw new Error(`UniversalAgentEvent.${field} is required`);
    }
    if (!idRe.test(value)) {
      throw new Error(`UniversalAgentEvent.${field} contains invalid characters`);
    }
  }
  if (!allowedFrameworks.has(event.framework)) {
    throw new Error(
      `UniversalAgentEvent.framework must be one of ${Array.from(allowedFrameworks).sort().join(", ")}`,
    );
  }
  if (!channelRe.test(event.channel)) {
    throw new Error("channel must match allowed Nexus channel pattern");
  }
  if (!Number.isInteger(event.timestampMs) || event.timestampMs <= 0) {
    throw new Error("timestamp_ms must be an integer Unix timestamp in milliseconds");
  }
}

function stringValue(value: unknown, field: string, fallback?: string): string {
  const resolved = value ?? fallback;
  if (typeof resolved !== "string" || resolved.length === 0) {
    throw new Error(`UniversalAgentEvent.${field} is required`);
  }
  return resolved;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("optional string fields must be strings when provided");
  }
  return value;
}

function eventTypeValue(value: unknown): UniversalEventType {
  if (typeof value !== "string" || !(universalEventTypes as readonly string[]).includes(value)) {
    throw new Error(`event_type must be one of ${universalEventTypes.join(", ")}`);
  }
  return value as UniversalEventType;
}

function recordValue(value: unknown, field: string, fallback: Record<string, unknown>): Record<string, unknown> {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return recordValue(value, field, {});
}

function optionalMessages(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("messages must be an array when provided");
  }
  return value;
}

function stringArray(value: unknown, field: string, fallback: string[]): string[] {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.length > 0)) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
}

function integerValue(value: unknown, field: string, fallback: number): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved)) {
    throw new Error(`${field} must be an integer Unix timestamp in milliseconds`);
  }
  return resolved as number;
}

function randomId(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

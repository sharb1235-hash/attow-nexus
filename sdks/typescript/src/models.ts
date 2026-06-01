import { z } from "zod";

export const channelSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*:[A-Za-z0-9_.:\-*]+$/, "channel must look like topic:name");

export const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_.:\-]+$/, "IDs may contain letters, numbers, underscore, dash, dot, or colon");

export const registerAgentSchema = z.object({
  agentId: idSchema,
  runId: idSchema,
  threadId: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  framework: z.string().default("custom"),
  language: z.string().default("typescript"),
  metadata: z.record(z.string()).default({}),
});

export const publishDeltaSchema = z.object({
  channel: channelSchema,
  agentId: idSchema.default("typescript-agent"),
  runId: idSchema.default("typescript-run"),
  threadId: z.string().optional(),
  delta: z.record(z.unknown()),
  durable: z.boolean().default(false),
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string()).default({}),
});

export const checkpointSchema = z.object({
  agentId: idSchema,
  runId: idSchema,
  threadId: z.string().optional(),
  channel: channelSchema,
  state: z.record(z.unknown()),
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  objective: z.string().optional(),
  metadata: z.record(z.string()).default({}),
});

export type RegisterAgentInput = z.input<typeof registerAgentSchema>;
export type PublishDeltaInput = z.input<typeof publishDeltaSchema>;
export type CheckpointInput = z.input<typeof checkpointSchema>;

export interface DeltaResult {
  deltaId: string;
  commitId: string;
  accepted: boolean;
  persisted: boolean;
  warning?: string;
  redacted?: boolean;
}

export interface ForkResult {
  sourceCommitId: string;
  runId: string;
  headCommitId: string;
}


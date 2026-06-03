import { pollJson } from "./asyncIterable";
import { NexusConnectionError } from "./errors";
import {
  CheckpointInput,
  DeltaResult,
  ForkResult,
  PublishDeltaInput,
  RegisterAgentInput,
  checkpointSchema,
  publishDeltaSchema,
  registerAgentSchema,
} from "./models";
import { redact } from "./redaction";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface NexusClientOptions {
  baseUrl?: string;
  token?: string;
  fetchImpl?: FetchLike;
}

export class NexusClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: FetchLike;

  private constructor(options: NexusClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:7822").replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static async connect(options: NexusClientOptions = {}): Promise<NexusClient> {
    return new NexusClient(options);
  }

  async registerAgent(input: RegisterAgentInput): Promise<Record<string, unknown>> {
    const parsed = registerAgentSchema.parse(input);
    return this.post("/api/agents/register", {
      agent_id: parsed.agentId,
      run_id: parsed.runId,
      thread_id: parsed.threadId,
      framework: parsed.framework,
      language: parsed.language,
      capabilities: parsed.capabilities,
      metadata: parsed.metadata,
    });
  }

  async publishDelta(input: PublishDeltaInput): Promise<DeltaResult> {
    const parsed = publishDeltaSchema.parse(input);
    const clean = redact(parsed.delta).value;
    return this.post("/api/deltas", {
      channel: parsed.channel,
      agent_id: parsed.agentId,
      run_id: parsed.runId,
      thread_id: parsed.threadId,
      delta: clean,
      durable: parsed.durable,
      summary: parsed.summary,
      tags: parsed.tags,
      metadata: parsed.metadata,
    });
  }

  subscribe(channel: string, intervalMs = 1000): AsyncIterable<Record<string, unknown>> {
    const encoded = encodeURIComponent(channel);
    return pollJson(
      () => this.get<Array<Record<string, unknown>>>(`/api/channels/${encoded}/deltas`),
      (item) => String(item.delta_id ?? item.deltaId ?? JSON.stringify(item)),
      intervalMs,
    );
  }

  async checkpoint(input: CheckpointInput): Promise<DeltaResult> {
    const parsed = checkpointSchema.parse(input);
    const clean = redact(parsed.state).value;
    return this.post("/api/checkpoint", {
      agent_id: parsed.agentId,
      run_id: parsed.runId,
      thread_id: parsed.threadId,
      channel: parsed.channel,
      state: clean,
      summary: parsed.summary,
      objective: parsed.objective,
      parent_commit_ids: parsed.parentCommitIds,
      tags: parsed.tags,
      metadata: parsed.metadata,
    });
  }

  async replay(commitId: string, mode = "state_only"): Promise<Record<string, unknown>> {
    return this.post("/api/replay", { commit_id: commitId, mode });
  }

  async diff(commitA: string, commitB: string): Promise<Record<string, unknown>> {
    return this.get(`/api/diff?from=${encodeURIComponent(commitA)}&to=${encodeURIComponent(commitB)}`);
  }

  async fork(commitId: string, newRunId?: string): Promise<ForkResult> {
    return this.post("/api/fork", { source_commit_id: commitId, new_run_id: newRunId ?? "" });
  }

  async rollback(headCommitId: string, targetCommitId: string, force = false): Promise<Record<string, unknown>> {
    return this.post("/api/rollback", {
      head_commit_id: headCommitId,
      target_commit_id: targetCommitId,
      force,
    });
  }

  async recordSideEffect(input: {
    agentId: string;
    runId: string;
    channel: string;
    state: Record<string, unknown>;
    kind: string;
    description: string;
    target?: string;
  }): Promise<DeltaResult> {
    const clean = redact(input.state).value;
    return this.post("/api/checkpoint", {
      agent_id: input.agentId,
      run_id: input.runId,
      channel: input.channel,
      state: clean,
      summary: `Recorded external side effect: ${input.kind}`,
      external_side_effects: [
        {
          kind: input.kind,
          description: input.description,
          target: input.target ?? "",
          reversible: false,
          compensating_action_available: false,
        },
      ],
    });
  }

  createRun(runId: string, objective?: string): { runId: string; objective?: string } {
    return { runId, objective };
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new NexusConnectionError(String(error));
    }
    const text = await response.text();
    if (!response.ok) {
      throw new NexusConnectionError(`daemon returned ${response.status}: ${text}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }
}

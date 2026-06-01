export interface Health {
  status: string;
  daemonVersion: string;
  protocolVersion: string;
  authRequired: boolean;
  bindMode: string;
  localOnly: boolean;
}

export interface AgentInfo {
  agent_id: string;
  run_id: string;
  thread_id: string;
  status: string;
  framework: string;
  language: string;
  capabilities: string[];
  last_seen_seconds: number;
  active_channels: string[];
}

export interface ChannelInfo {
  name: string;
  durable_count: number;
  ephemeral_count: number;
  publishers: string[];
  subscribers: string[];
}

export interface DeltaInfo {
  delta_id: string;
  commit_id: string;
  channel: string;
  agent_id: string;
  run_id: string;
  durable: boolean;
  summary: string;
  wall_time_seconds: number;
}

export interface CommitSummary {
  commitId: string;
  deltaId: string;
  runId: string;
  agentId: string;
  channel: string;
  summary: string;
  tags: string[];
  parentCommitIds: string[];
  sideEffectCount: number;
}

export interface MetricsSummary {
  nexus_agents_connected: number;
  nexus_channels_total: number;
  nexus_subscriptions_total: number;
  nexus_deltas_total: number;
  nexus_ephemeral_deltas_total: number;
  nexus_durable_deltas_total: number;
  nexus_commits_total: number;
  nexus_loop_warnings_total: number;
  nexus_backpressure_events_total: number;
  nexus_dropped_ephemeral_total: number;
  nexus_artifacts_total: number;
  nexus_errors_total: number;
  nexus_memory_bytes: number;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => getJson<Health>("/api/health"),
  agents: () => getJson<AgentInfo[]>("/api/agents"),
  channels: () => getJson<ChannelInfo[]>("/api/channels"),
  channelSnapshot: (channel: string) => getJson<Record<string, unknown>>(`/api/channels/${encodeURIComponent(channel)}/snapshot`),
  channelDeltas: (channel: string) => getJson<DeltaInfo[]>(`/api/channels/${encodeURIComponent(channel)}/deltas`),
  runs: () => getJson<Array<Record<string, unknown>>>("/api/runs"),
  runCommits: (runId: string) => getJson<CommitSummary[]>(`/api/runs/${encodeURIComponent(runId)}/commits`),
  commit: (commitId: string) => getJson<Record<string, unknown>>(`/api/commits/${encodeURIComponent(commitId)}`),
  diff: (from: string, to: string) => getJson<Record<string, unknown>>(`/api/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  replay: (commitId: string) =>
    postJson<Record<string, unknown>>("/api/replay", { commit_id: commitId, mode: "state_only" }),
  fork: (commitId: string, newRunId: string) =>
    postJson<Record<string, unknown>>("/api/fork", { source_commit_id: commitId, new_run_id: newRunId }),
  rollback: (head: string, target: string, force: boolean) =>
    postJson<Record<string, unknown>>("/api/rollback", { head_commit_id: head, target_commit_id: target, force }),
  loopWarnings: () => getJson<Array<Record<string, unknown>>>("/api/loop-warnings"),
  metrics: () => getJson<MetricsSummary>("/api/metrics-summary")
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}


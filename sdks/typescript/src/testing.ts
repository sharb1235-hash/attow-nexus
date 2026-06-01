import { DeltaResult, ForkResult } from "./models";

export class FakeNexusClient {
  readonly events: Array<Record<string, unknown>> = [];

  async registerAgent(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.events.push({ type: "registerAgent", ...input });
    return { accepted: true, agentId: input.agentId, protocolVersion: "nexus.v1" };
  }

  async publishDelta(input: Record<string, unknown>): Promise<DeltaResult> {
    this.events.push({ type: "publishDelta", ...input });
    return { deltaId: "delta_fake", commitId: "", accepted: true, persisted: false };
  }

  async checkpoint(input: Record<string, unknown>): Promise<DeltaResult> {
    this.events.push({ type: "checkpoint", ...input });
    return { deltaId: "delta_fake", commitId: "c_fake", accepted: true, persisted: true };
  }

  async fork(commitId: string, newRunId?: string): Promise<ForkResult> {
    return { sourceCommitId: commitId, runId: newRunId ?? "run_fake", headCommitId: commitId };
  }
}


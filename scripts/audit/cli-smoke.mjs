import { spawn } from "node:child_process";

const repoRoot = new URL("../..", import.meta.url);
const apiBase = process.env.NEXUS_HTTP_URL ?? "http://127.0.0.1:7822";

main().catch((error) => {
  console.error(`CLI smoke failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  await requireDaemon();
  const runId = `cli-smoke-${Date.now()}`;
  await postJson("/api/agents/register", {
    agent_id: "cli-smoke-agent",
    run_id: runId,
    framework: "audit-script",
    language: "javascript",
    capabilities: ["cli-smoke"]
  });
  const first = await postJson("/api/checkpoint", {
    agent_id: "cli-smoke-agent",
    run_id: runId,
    channel: "topic:cli_smoke",
    state: { step: 1, stable: true },
    summary: "CLI smoke first commit"
  });
  const second = await postJson("/api/checkpoint", {
    agent_id: "cli-smoke-agent",
    run_id: runId,
    channel: "topic:cli_smoke",
    state: { step: 2, stable: false },
    summary: "CLI smoke second commit",
    parent_commit_ids: [first.commitId]
  });

  await expectOk(["run", "-p", "nexus", "--", "doctor"], "doctor");
  await expectOk(["run", "-p", "nexus", "--", "fork", first.commitId, "--new-run", `${runId}-fork`], "fork");
  await expectOk(["run", "-p", "nexus", "--", "export", "--run", runId, "--format", "json"], "export");
  await expectOk(["run", "-p", "nexus", "--", "rollback", "--head", second.commitId, "--to", first.commitId], "rollback");

  const invalid = await runCargo(["run", "-p", "nexus", "--", "inspect", "missing-commit"]);
  if (invalid.code === 0) {
    throw new Error("invalid inspect command unexpectedly succeeded");
  }

  console.log(
    JSON.stringify(
      {
        runId,
        firstCommitId: first.commitId,
        secondCommitId: second.commitId,
        checked: ["doctor", "fork", "export", "rollback", "invalid inspect nonzero"]
      },
      null,
      2
    )
  );
}

async function requireDaemon() {
  const response = await fetch(`${apiBase}/api/health`).catch(() => null);
  if (!response?.ok) {
    throw new Error("Attow Nexus daemon is not reachable. Run docker compose up --build first.");
  }
}

async function postJson(path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function expectOk(args, label) {
  const result = await runCargo(args);
  if (result.code !== 0) {
    throw new Error(`${label} failed: ${result.stderr}\n${result.stdout}`);
  }
}

function runCargo(args) {
  return new Promise((resolve) => {
    const child = spawn("cargo", args, {
      cwd: repoRoot,
      windowsHide: true,
      shell: false,
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (error) => resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` }));
  });
}

import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const repoRoot = new URL("../..", import.meta.url);
const apiBase = "http://127.0.0.1:7822";
const metricsBase = "http://127.0.0.1:7823";
const levels = parseLevels(process.argv);

main().catch((error) => {
  console.error(`Audit stress test failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const health = await getJson(`${apiBase}/api/health`).catch(() => null);
  if (!health || health.status !== "ok") {
    throw new Error("Attow Nexus daemon is not healthy. Run docker compose up --build first.");
  }

  console.log(`Attow Nexus health: ${JSON.stringify(health)}`);
  console.log(`Stress levels: ${levels.join(", ")}`);

  for (const count of levels) {
    const runId = `audit-stress-${count}-${Date.now()}`;
    const agentId = "audit-stress-agent";
    const before = parseMetrics(await getText(`${metricsBase}/metrics`));

    await postJson(`${apiBase}/api/agents/register`, {
      agent_id: agentId,
      run_id: runId,
      framework: "audit-script",
      language: "javascript",
      capabilities: ["stress-test"]
    });

    const start = performance.now();
    let lastCommitId = "";
    for (let idx = 0; idx < count; idx += 1) {
      const response = await postJson(`${apiBase}/api/checkpoint`, {
        agent_id: agentId,
        run_id: runId,
        channel: `topic:audit_stress_${count}`,
        state: {
          idx,
          count,
          message: "local audit stress checkpoint",
          nested: { parity: idx % 2 === 0 ? "even" : "odd" }
        },
        summary: `Audit stress checkpoint ${idx + 1}/${count}`,
        tags: ["audit", "stress", String(count)]
      });
      lastCommitId = response.commitId;
    }
    const elapsedMs = performance.now() - start;
    const after = parseMetrics(await getText(`${metricsBase}/metrics`));

    const cli = await runCli(["run", "-p", "nexus", "--", "log", "--run", runId]);
    const cliOk = cli.code === 0 && cli.stdout.includes(lastCommitId);

    console.log(
      JSON.stringify(
        {
          level: count,
          runId,
          lastCommitId,
          elapsedMs: Number(elapsedMs.toFixed(2)),
          commitsPerSecond: Number((count / (elapsedMs / 1000)).toFixed(2)),
          metricsBefore: pickMetrics(before),
          metricsAfter: pickMetrics(after),
          cliLogVerified: cliOk
        },
        null,
        2
      )
    );

    if (!cliOk) {
      throw new Error(`CLI log verification failed for ${runId}.`);
    }
  }
}

function parseLevels(argv) {
  const index = argv.indexOf("--levels");
  if (index >= 0 && argv[index + 1]) {
    return argv[index + 1]
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }
  return [10, 100, 500];
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function getText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.text();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${url} returned HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

function parseMetrics(text) {
  const metrics = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(nexus_[a-z_]+)\s+([0-9.]+)$/);
    if (match) {
      metrics[match[1]] = Number(match[2]);
    }
  }
  return metrics;
}

function pickMetrics(metrics) {
  return {
    nexus_agents_connected: metrics.nexus_agents_connected ?? 0,
    nexus_channels_total: metrics.nexus_channels_total ?? 0,
    nexus_deltas_total: metrics.nexus_deltas_total ?? 0,
    nexus_durable_deltas_total: metrics.nexus_durable_deltas_total ?? 0,
    nexus_commits_total: metrics.nexus_commits_total ?? 0,
    nexus_errors_total: metrics.nexus_errors_total ?? 0
  };
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn("cargo", args, {
      cwd: repoRoot,
      windowsHide: true,
      shell: false
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

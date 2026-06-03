const apiBase = "http://127.0.0.1:7822";
const metricsBase = "http://127.0.0.1:7823";

main().catch((error) => {
  console.error(`Artifact stress failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const health = await getJson(`${apiBase}/api/health`).catch(() => null);
  if (!health || health.status !== "ok") {
    throw new Error("Attow Nexus daemon is not healthy. Run docker compose up --build first.");
  }

  const runId = `artifact-stress-${Date.now()}`;
  const before = parseMetrics(await getText(`${metricsBase}/metrics`));
  await postJson(`${apiBase}/api/agents/register`, {
    agent_id: "artifact-stress-agent",
    run_id: runId,
    framework: "audit-script",
    language: "javascript",
    capabilities: ["artifact-stress"]
  });

  const sizes = [
    ["small-inline", 1024],
    ["near-threshold", 60000],
    ["large-artifact", 90000]
  ];
  const commits = [];
  for (const [label, size] of sizes) {
    const response = await postJson(`${apiBase}/api/checkpoint`, {
      agent_id: "artifact-stress-agent",
      run_id: runId,
      channel: "topic:artifact_stress",
      state: { label, size, payload: "x".repeat(size) },
      summary: `Artifact stress ${label}`
    });
    commits.push({ label, size, commitId: response.commitId });
  }

  const after = parseMetrics(await getText(`${metricsBase}/metrics`));
  const artifactDelta = (after.nexus_artifacts_total ?? 0) - (before.nexus_artifacts_total ?? 0);
  if (artifactDelta < 1) {
    throw new Error(`expected artifact count to increase for large payload, before=${before.nexus_artifacts_total ?? 0}, after=${after.nexus_artifacts_total ?? 0}`);
  }

  const replay = await postJson(`${apiBase}/api/replay`, {
    commit_id: commits[commits.length - 1].commitId,
    mode: "state_only"
  });

  console.log(
    JSON.stringify(
      {
        runId,
        commits,
        artifactsBefore: before.nexus_artifacts_total ?? 0,
        artifactsAfter: after.nexus_artifacts_total ?? 0,
        artifactDelta,
        replayMissingArtifactWarnings: replay.missingArtifactWarnings ?? []
      },
      null,
      2
    )
  );
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function getText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

function parseMetrics(text) {
  const metrics = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(nexus_[a-z_]+)\s+([0-9.]+)$/);
    if (match) metrics[match[1]] = Number(match[2]);
  }
  return metrics;
}

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fixtureDir = join(root, "test-fixtures", "universal-events");
const api = "http://127.0.0.1:7822";
const metricsUrl = "http://127.0.0.1:7823/metrics";

async function main() {
  await requireHealthyDaemon();
  const beforeMetrics = await readMetrics();
  const commits = new Map();

  for (const name of [
    "langgraph-run-start.json",
    "crewai-task-start.json",
    "parent-chain-start.json",
    "crewai-task-end.json",
    "vercel-step-finish.json",
    "stream-delta.json",
    "error-event.json",
    "large-payload-event.json",
    "redaction-event.json",
  ]) {
    const event = fixture(name);
    if (name === "crewai-task-end.json") {
      event.parent_commit_ids = [commits.get("crewai-task-start.json")];
    }
    if (name === "vercel-step-finish.json") {
      event.parent_commit_ids = [commits.get("crewai-task-end.json")];
    }
    if (name === "stream-delta.json") {
      event.parent_commit_ids = [commits.get("vercel-step-finish.json")];
    }
    if (name === "error-event.json") {
      event.parent_commit_ids = [commits.get("stream-delta.json")];
    }
    const response = await postEvent(event);
    commits.set(name, response.commitId);
    console.log(`${name}: ${response.commitId}`);
  }

  const child = fixture("parent-chain-child.json");
  child.parent_commit_ids = [commits.get("parent-chain-start.json")];
  const childResponse = await postEvent(child);
  commits.set("parent-chain-child.json", childResponse.commitId);
  console.log(`parent-chain-child.json: ${childResponse.commitId}`);

  await expectMalformed("malformed-missing-run-id.json", "run_id");
  await expectMalformed("malformed-invalid-channel.json", "channel");
  await expectMalformed("malformed-bad-parent-ids.json", "parent_commit_ids");

  const afterMetrics = await readMetrics();
  if ((afterMetrics.nexus_commits_total ?? 0) <= (beforeMetrics.nexus_commits_total ?? 0)) {
    throw new Error("Expected nexus_commits_total to increment during contract smoke");
  }

  const log = run("cargo", ["run", "-p", "nexus", "--", "log", "--run", "contract-fixture-demo"]);
  for (const expected of ["langgraph", "crewai", "vercel-ai", "redaction-worker"]) {
    if (!log.includes(expected)) {
      throw new Error(`Expected CLI log to contain ${expected}`);
    }
  }

  console.log("Contract smoke passed: canonical fixtures created commits and malformed fixtures failed.");
}

async function requireHealthyDaemon() {
  const response = await fetch(`${api}/api/health`).catch(() => undefined);
  if (!response?.ok) {
    throw new Error("Attow Nexus daemon is not reachable. Run `docker compose up --build` first.");
  }
}

function fixture(name) {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8"));
}

async function postEvent(event) {
  const response = await fetch(`${api}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`/api/events rejected ${event.event_id}: ${response.status} ${text}`);
  }
  return JSON.parse(text);
}

async function expectMalformed(name, expectedText) {
  const response = await fetch(`${api}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixture(name)),
  });
  const text = await response.text();
  if (response.ok) {
    throw new Error(`${name} unexpectedly succeeded`);
  }
  if (!text.includes(expectedText)) {
    throw new Error(`${name} failed without expected message ${expectedText}: ${text}`);
  }
  console.log(`${name}: rejected as expected`);
}

async function readMetrics() {
  const response = await fetch(metricsUrl);
  const text = await response.text();
  const metrics = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(nexus_[a-z_]+)\s+([0-9.]+)$/);
    if (match) {
      metrics[match[1]] = Number(match[2]);
    }
  }
  return metrics;
}

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

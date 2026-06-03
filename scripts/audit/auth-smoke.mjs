import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = new URL("../..", import.meta.url);
const token = "audit-token";
const httpUrl = "http://127.0.0.1:7922";

main().catch((error) => {
  console.error(`Auth smoke failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "attow-nexus-auth-"));
  const daemon = spawn("cargo", ["run", "-p", "nexus", "--", "daemon", "start"], {
    cwd: repoRoot,
    windowsHide: true,
    shell: false,
    env: {
      ...process.env,
      NEXUS_BIND_MODE: "tcp",
      NEXUS_REQUIRE_AUTH: "true",
      NEXUS_AUTH_TOKEN: token,
      NEXUS_ALLOW_REMOTE: "false",
      NEXUS_DATA_DIR: dataDir,
      NEXUS_SQLITE_PATH: path.join(dataDir, "nexus.sqlite"),
      NEXUS_ARTIFACT_DIR: path.join(dataDir, "artifacts"),
      NEXUS_GRPC_ADDR: "127.0.0.1:7921",
      NEXUS_HTTP_ADDR: "127.0.0.1:7922",
      NEXUS_METRICS_ADDR: "127.0.0.1:7923"
    }
  });

  let output = "";
  daemon.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  daemon.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHealth();
    const publicHealth = await fetch(`${httpUrl}/api/health`);
    assert(publicHealth.ok, "health should remain public for local diagnostics");

    const noToken = await fetch(`${httpUrl}/api/agents`);
    assert(noToken.status === 401, `expected no-token /api/agents to return 401, got ${noToken.status}`);

    const wrongToken = await fetch(`${httpUrl}/api/agents`, {
      headers: { authorization: "Bearer wrong-token" }
    });
    assert(wrongToken.status === 403, `expected wrong-token /api/agents to return 403, got ${wrongToken.status}`);

    const correctToken = await fetch(`${httpUrl}/api/agents`, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert(correctToken.ok, `expected correct-token /api/agents to succeed, got ${correctToken.status}`);

    const cliWithoutToken = await run("cargo", ["run", "-p", "nexus", "--", "agents"], {
      NEXUS_HTTP_URL: httpUrl,
      NEXUS_AUTH_TOKEN: ""
    });
    assert(cliWithoutToken.code !== 0, "CLI agents should fail without token when auth is required");

    const cliWithToken = await run("cargo", ["run", "-p", "nexus", "--", "agents"], {
      NEXUS_HTTP_URL: httpUrl,
      NEXUS_AUTH_TOKEN: token
    });
    assert(cliWithToken.code === 0, `CLI agents should succeed with token: ${cliWithToken.stderr}`);

    console.log("Auth smoke passed: health public, protected API rejects missing/wrong tokens, direct API and CLI accept correct token.");
  } finally {
    killProcessTree(daemon);
    await fs.rm(dataDir, { recursive: true, force: true });
  }

  if (daemon.exitCode && daemon.exitCode !== 0 && !output.includes("listening")) {
    throw new Error(output);
  }
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`${httpUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("auth daemon did not become healthy");
}

function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...env }
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function killProcessTree(child) {
  if (!child.pid) {
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

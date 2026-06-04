import { execFileSync } from "node:child_process";

const root = process.cwd();
const apiBase = process.env.NEXUS_HTTP_URL ?? "http://127.0.0.1:7822";

main().catch((error) => {
  console.error(`Broken agent recovery smoke failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  await requireDaemon();

  const demoOutput = run(pythonCommand(), [demoScriptPath()]);
  const commits = parseCommits(demoOutput);

  const log = run("cargo", ["run", "-p", "nexus", "--", "log", "--run", "broken-agent-demo"]);
  const badDiff = run("cargo", ["run", "-p", "nexus", "--", "diff", commits.lastGood, commits.bad]);
  const lastGoodReplay = run("cargo", ["run", "-p", "nexus", "--", "replay", commits.lastGood]);
  const finalReplay = run("cargo", ["run", "-p", "nexus", "--", "replay", commits.final]);

  const combined = [demoOutput, log, badDiff, lastGoodReplay, finalReplay].join("\n");
  [
    "planner-agent",
    "coder-agent",
    "reviewer-agent",
    "retry_limit must be an integer",
    "validation passed",
    "recovery",
    "retry_limit"
  ].forEach((needle) => assertContains(combined, needle));

  console.log(
    [
      "Broken agent recovery smoke passed.",
      `last_good=${commits.lastGood}`,
      `bad_commit=${commits.bad}`,
      `recovery_commit=${commits.recovery}`,
      `final_commit=${commits.final}`
    ].join("\n")
  );
}

async function requireDaemon() {
  const response = await fetch(`${apiBase}/api/health`).catch(() => null);
  if (!response?.ok) {
    throw new Error("Attow Nexus daemon is not reachable. Run `docker compose up --build` first.");
  }
}

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  try {
    const output = execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (output.trim()) {
      console.log(output.trim());
    }
    return output;
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    console.error(stdout);
    console.error(stderr);
    process.exit(error.status ?? 1);
  }
}

function parseCommits(output) {
  return {
    lastGood: mustMatch(output, /LAST GOOD COMMIT:\s*(c_[A-Za-z0-9]+)/),
    bad: mustMatch(output, /BAD COMMIT:\s*(c_[A-Za-z0-9]+)/),
    recovery: mustMatch(output, /RECOVERY COMMIT:\s*(c_[A-Za-z0-9]+)/),
    final: mustMatch(output, /FINAL PASS COMMIT:\s*(c_[A-Za-z0-9]+)/)
  };
}

function mustMatch(text, pattern) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`Could not parse expected commit ID with pattern ${pattern}`);
  }
  return match[1];
}

function assertContains(text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`Expected output to contain: ${needle}`);
  }
}

function pythonCommand() {
  return process.platform === "win32" ? "py" : "python3";
}

function demoScriptPath() {
  return process.platform === "win32"
    ? "examples\\broken-agent-recovery\\run_demo.py"
    : "examples/broken-agent-recovery/run_demo.py";
}

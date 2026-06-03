import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

async function main() {
  const health = await fetch("http://127.0.0.1:7822/api/health").catch(() => undefined);
  if (!health?.ok) {
    console.error("Attow Nexus daemon is not reachable. Run `docker compose up --build` first.");
    process.exit(1);
  }

  run("py", ["examples\\universal-translation-demo\\langgraph_planner.py"]);
  run("py", ["examples\\universal-translation-demo\\crewai_researcher.py"]);

  const demoDir = join(root, "examples", "universal-translation-demo");
  if (!existsSync(join(demoDir, "node_modules"))) {
    runCmd(["npm.cmd", "install"], demoDir);
  }
  runCmd(["npm.cmd", "run", "vercel-demo"], demoDir);

  const agents = run("cargo", ["run", "-p", "nexus", "--", "agents"]);
  const channels = run("cargo", ["run", "-p", "nexus", "--", "channels"]);
  run("cargo", ["run", "-p", "nexus", "--", "log", "--run", "universal-demo"]);

  assertContains(agents, "langgraph-planner");
  assertContains(agents, "crewai-researcher");
  assertContains(agents, "vercel-ai-frontend");
  assertContains(channels, "framework:langgraph:universal-demo");
  assertContains(channels, "framework:crewai:universal-demo");
  assertContains(channels, "framework:vercel-ai:universal-demo");

  console.log("Universal demo smoke passed: three framework surfaces wrote to run_id=universal-demo.");
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

function runCmd(args, cwd = root) {
  return run("cmd.exe", ["/c", ...args], cwd);
}

function assertContains(text, needle) {
  if (!text.includes(needle)) {
    console.error(`Expected output to contain: ${needle}`);
    process.exit(1);
  }
}

main();

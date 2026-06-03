import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const outDir = path.join(scriptDir, "out");
const assetsDir = path.join(repoRoot, "docs", "assets");
const mp4Path = path.join(assetsDir, "nexus-demo.mp4");
const gifPath = path.join(assetsDir, "nexus-demo.gif");
const makeGif = process.argv.includes("--gif");

const apiBase = "http://127.0.0.1:7822";
const metricsBase = "http://127.0.0.1:7823";
const targetMetrics = {
  nexus_agents_connected: 2,
  nexus_channels_total: 2,
  nexus_deltas_total: 2,
  nexus_durable_deltas_total: 2,
  nexus_commits_total: 2
};

const sceneDurations = [4, 6, 7, 7, 8, 9, 4];

main().catch((error) => {
  console.error(`\nDemo video generation failed:\n${error.message}`);
  process.exit(1);
});

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(assetsDir, { recursive: true });

  await ensureFfmpeg();
  const playwright = await loadPlaywright();

  const health = await requireDaemon();
  await writeJson("health.json", health);
  const healthCurl = await runCapture(curlCommand(), [`${apiBase}/api/health`], {
    cwd: repoRoot,
    label: "curl.exe http://127.0.0.1:7822/api/health",
    outFile: "health.txt"
  });

  const preMetricsText = await fetchText(`${metricsBase}/metrics`);
  const preMetrics = parseMetrics(preMetricsText);
  await fs.writeFile(path.join(outDir, "metrics-before.txt"), preMetricsText);

  let commits = await fetchDemoCommits();
  let demoOutput = "";
  if (isTargetMetrics(preMetrics) && commits.length >= 2) {
    demoOutput = [
      "$ py examples\\python-basic\\main.py",
      "Existing exact demo state detected; skipped rerun to preserve the 2-commit metric scene.",
      `created commits: ${commits[0].commitId} ${commits[1].commitId}`,
      `try: nexus diff ${commits[0].commitId} ${commits[1].commitId}`
    ].join("\n");
    await fs.writeFile(path.join(outDir, "python-demo.txt"), demoOutput);
  } else {
    assertFreshEnough(preMetrics);
    ensurePythonSdkImportable();
    const result = await runCapture("py", ["examples\\python-basic\\main.py"], {
      cwd: repoRoot,
      label: "py examples\\python-basic\\main.py",
      outFile: "python-demo.txt"
    });
    demoOutput = result.combined;
    commits = await fetchDemoCommits();
  }

  if (commits.length < 2) {
    throw new Error("The demo did not produce two commits for run demo-run.");
  }
  const commitA = commits[0].commitId;
  const commitB = commits[1].commitId;

  const metricsText = await runCapture(curlCommand(), [`${metricsBase}/metrics`], {
    cwd: repoRoot,
    label: "curl.exe http://127.0.0.1:7823/metrics",
    outFile: "metrics.txt"
  });
  const postMetrics = parseMetrics(metricsText.combined);
  assertTargetMetrics(postMetrics);

  const agents = await runCapture("cargo", ["run", "-p", "nexus", "--", "agents"], {
    cwd: repoRoot,
    label: "cargo run -p nexus -- agents",
    outFile: "cli-agents.txt"
  });
  const channels = await runCapture("cargo", ["run", "-p", "nexus", "--", "channels"], {
    cwd: repoRoot,
    label: "cargo run -p nexus -- channels",
    outFile: "cli-channels.txt"
  });
  const log = await runCapture("cargo", ["run", "-p", "nexus", "--", "log", "--run", "demo-run"], {
    cwd: repoRoot,
    label: "cargo run -p nexus -- log --run demo-run",
    outFile: "cli-log.txt"
  });
  await runCapture("cargo", ["run", "-p", "nexus", "--", "diff", commitA, commitB], {
    cwd: repoRoot,
    label: `cargo run -p nexus -- diff ${commitA} ${commitB}`,
    outFile: "cli-diff.txt"
  });
  await runCapture("cargo", ["run", "-p", "nexus", "--", "replay", commitB], {
    cwd: repoRoot,
    label: `cargo run -p nexus -- replay ${commitB}`,
    outFile: "cli-replay.txt"
  });

  const dashboard = await ensureDashboardServer();
  let browser;
  try {
    browser = await launchBrowser(playwright);
    const screenshots = await captureDashboardScreens(browser, dashboard.url);
    const slides = await renderSlides(browser, {
      health,
      healthCurl: healthCurl.combined,
      demoOutput,
      metricsText: metricsText.combined,
      cliText: [agents.combined, channels.combined, log.combined].join("\n\n"),
      screenshots,
      commitA,
      commitB
    });
    await assembleMp4(slides);
    if (makeGif) {
      await assembleGif();
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    if (dashboard.startedProcess) {
      dashboard.startedProcess.kill();
    }
  }

  const stat = await fs.stat(mp4Path);
  if (stat.size === 0) {
    throw new Error(`Generated MP4 is empty: ${mp4Path}`);
  }

  console.log(`\nDemo video created: ${mp4Path}`);
  if (makeGif) {
    console.log(`Demo GIF created: ${gifPath}`);
  }
}

async function ensureFfmpeg() {
  const result = await run("ffmpeg", ["-version"], { cwd: repoRoot, allowFailure: true });
  if (result.code !== 0) {
    throw new Error("Install FFmpeg or use winget install Gyan.FFmpeg");
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright is not installed. Run npm.cmd --prefix scripts/demo install");
  }
}

async function launchBrowser(playwright) {
  try {
    return await playwright.chromium.launch();
  } catch (error) {
    if (String(error.message).includes("Executable doesn't exist")) {
      throw new Error("Run npx.cmd playwright install chromium");
    }
    throw error;
  }
}

async function requireDaemon() {
  let response;
  try {
    response = await fetch(`${apiBase}/api/health`, { signal: AbortSignal.timeout(3000) });
  } catch {
    throw new Error("Attow Nexus daemon is not reachable. Run docker compose up --build first.");
  }
  if (!response.ok) {
    throw new Error(`Attow Nexus daemon health check failed with HTTP ${response.status}. Run docker compose up --build first.`);
  }
  const health = await response.json();
  if (health.status !== "ok") {
    throw new Error(`Attow Nexus daemon is reachable but not healthy: ${JSON.stringify(health)}`);
  }
  return health;
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchDemoCommits() {
  const commits = await fetchJson(`${apiBase}/api/runs/demo-run/commits`).catch(() => []);
  return commits
    .filter((commit) => commit.commitId && ["planner", "researcher"].includes(commit.agentId))
    .sort((a, b) => String(a.wallTime ?? "").localeCompare(String(b.wallTime ?? "")))
    .slice(0, 2);
}

function assertFreshEnough(metrics) {
  const relevant = Object.keys(targetMetrics);
  const dirty = relevant.filter((name) => Number(metrics[name] ?? 0) !== 0);
  if (dirty.length > 0) {
    throw new Error(
      [
        "Demo recording expects either a fresh daemon with zero demo counters or an already-exact 2-commit demo state.",
        "Current metrics are not clean enough to create an honest 45-second demo.",
        "Restart with a clean Docker volume, then run docker compose up --build first.",
        "Suggested reset for launch recording: docker compose down -v; docker compose up --build"
      ].join("\n")
    );
  }
}

function assertTargetMetrics(metrics) {
  const mismatches = Object.entries(targetMetrics).filter(([name, expected]) => Number(metrics[name] ?? 0) !== expected);
  if (mismatches.length > 0) {
    const details = mismatches
      .map(([name, expected]) => `${name}: expected ${expected}, got ${metrics[name] ?? 0}`)
      .join("\n");
    throw new Error(`Demo metrics do not match the validated 2-agent/2-commit story:\n${details}`);
  }
}

function isTargetMetrics(metrics) {
  return Object.entries(targetMetrics).every(([name, expected]) => Number(metrics[name] ?? 0) === expected);
}

function parseMetrics(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(nexus_[a-z_]+)\s+([0-9.]+)$/);
    if (match) {
      values[match[1]] = Number(match[2]);
    }
  }
  return values;
}

function ensurePythonSdkImportable() {
  const result = runSyncish("py", ["-c", "import nexus_ipc"], repoRoot);
  if (result.status !== 0) {
    throw new Error("Python SDK is not importable. Run cd sdks\\python; py -m pip install -e .");
  }
}

async function ensureDashboardServer() {
  const existing = await findDashboardUrl();
  if (existing) {
    await fs.writeFile(path.join(outDir, "dashboard-dev.txt"), `Using existing dashboard dev server: ${existing}\n`);
    return { url: existing, startedProcess: null };
  }

  const dashboardDir = path.join(repoRoot, "dashboard");
  if (!existsSync(path.join(dashboardDir, "node_modules"))) {
    console.log("Dashboard dependencies not found; running npm.cmd install in dashboard/.");
    await runCapture(npmCommand(), ["install"], {
      cwd: dashboardDir,
      label: "npm.cmd install",
      outFile: "dashboard-install.txt"
    });
  }

  const child = spawn(npmCommand(), ["run", "dev"], {
    cwd: dashboardDir,
    shell: false,
    windowsHide: true
  });
  let output = "";
  const outputFile = path.join(outDir, "dashboard-dev.txt");
  const append = async (chunk) => {
    output += chunk.toString();
    await fs.writeFile(outputFile, stripAnsi(output));
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  const url = await waitFor(async () => {
    const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
    if (match) {
      return match[0].replace(/\/$/, "");
    }
    return findDashboardUrl();
  }, 20000);

  return { url, startedProcess: child };
}

async function findDashboardUrl() {
  for (const port of [5173, 5174, 5175, 5176]) {
    const url = `http://127.0.0.1:${port}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      const text = await response.text();
      if (response.ok && text.includes("root")) {
        return url;
      }
    } catch {
      // Try the next likely Vite port.
    }
  }
  return null;
}

async function captureDashboardScreens(browser, dashboardUrl) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const routes = [
    ["home", "/"],
    ["agents", "/agents"],
    ["channels", "/channels"],
    ["ledger", "/ledger"]
  ];
  const screenshots = {};
  for (const [name, route] of routes) {
    const file = path.join(outDir, `dashboard-${name}.png`);
    await page.goto(`${dashboardUrl}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file, fullPage: false });
    screenshots[name] = file;
  }
  await page.close();
  return screenshots;
}

async function renderSlides(browser, context) {
  const slideDefs = [
    {
      name: "01-title.png",
      html: titleSlide(
        "Attow Nexus",
        "Git for AI agent state",
        "Local coordination daemon + Git-like ledger for polyglot AI agents"
      )
    },
    {
      name: "02-health.png",
      html: terminalSlide("API health check", "curl.exe http://127.0.0.1:7822/api/health", prettyHealth(context.health, context.healthCurl), [
        "status ok",
        "protocolVersion nexus.v1",
        "daemonVersion 0.1.0"
      ])
    },
    {
      name: "03-python-demo.png",
      html: terminalSlide("Python demo", "py examples\\python-basic\\main.py", context.demoOutput, [
        "created commits",
        context.commitA,
        context.commitB
      ])
    },
    {
      name: "04-metrics.png",
      html: terminalSlide("Metrics after the demo", "curl.exe http://127.0.0.1:7823/metrics", selectedMetricLines(context.metricsText), [
        "2 agents",
        "2 channels",
        "2 durable deltas",
        "2 commits"
      ])
    },
    {
      name: "05-cli.png",
      html: terminalSlide("CLI inspection", "cargo run -p nexus -- agents / channels / log --run demo-run", summarizeCli(context.cliText), [
        "planner",
        "researcher",
        "topic:plan",
        "topic:research"
      ])
    },
    {
      name: "06-dashboard.png",
      html: dashboardSlide(context.screenshots.home, context.screenshots.agents, context.screenshots.ledger)
    },
    {
      name: "07-closing.png",
      html: titleSlide(
        "Not another agent framework.",
        "The shared state and debugging substrate underneath them.",
        "Local state bus + Git-like ledger for polyglot AI agents"
      )
    }
  ];

  const slides = [];
  for (const def of slideDefs) {
    const file = path.join(outDir, def.name);
    await renderHtml(browser, def.html, file);
    slides.push(file);
  }
  return slides;
}

async function renderHtml(browser, html, file) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: file, fullPage: false });
  await page.close();
}

async function assembleMp4(slides) {
  const concatFile = path.join(outDir, "slides.concat.txt");
  const lines = [];
  slides.forEach((slide, index) => {
    lines.push(`file '${ffmpegPath(slide)}'`);
    lines.push(`duration ${sceneDurations[index]}`);
  });
  lines.push(`file '${ffmpegPath(slides[slides.length - 1])}'`);
  await fs.writeFile(concatFile, `${lines.join("\n")}\n`);
  await runCapture(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
      "-t",
      "45",
      "-vf",
      "fps=30,format=yuv420p",
      "-pix_fmt",
      "yuv420p",
      mp4Path
    ],
    {
      cwd: repoRoot,
      label: "ffmpeg assemble mp4",
      outFile: "ffmpeg-mp4.txt"
    }
  );
}

async function assembleGif() {
  await runCapture(
    "ffmpeg",
    ["-y", "-i", mp4Path, "-vf", "fps=12,scale=1280:-1:flags=lanczos", gifPath],
    {
      cwd: repoRoot,
      label: "ffmpeg assemble gif",
      outFile: "ffmpeg-gif.txt"
    }
  );
}

function titleSlide(title, subtitle, kicker) {
  return baseHtml(`
    <section class="center">
      <div class="mark">Attow Nexus Demo</div>
      <h1>${escapeHtml(title)}</h1>
      <h2>${escapeHtml(subtitle)}</h2>
      <p>${escapeHtml(kicker)}</p>
    </section>
  `);
}

function terminalSlide(title, command, text, chips = []) {
  return baseHtml(`
    <section class="slide">
      <div class="header">
        <div>
          <p class="eyebrow">Launch demo</p>
          <h1>${escapeHtml(title)}</h1>
        </div>
        <div class="chips">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>
      </div>
      <div class="terminal">
        <div class="bar"><span></span><span></span><span></span><strong>${escapeHtml(command)}</strong></div>
        <pre>${escapeHtml(trimForSlide(text))}</pre>
      </div>
    </section>
  `);
}

function dashboardSlide(homePath, agentsPath, ledgerPath) {
  return baseHtml(`
    <section class="slide">
      <div class="header">
        <div>
          <p class="eyebrow">Attow Nexus Console</p>
          <h1>Live agent bus + ledger observability</h1>
        </div>
        <div class="chips"><span>2 connected agents</span><span>2 active channels</span><span>2 recent commits</span></div>
      </div>
      <div class="dashboard-grid">
        <img class="large-shot" src="${pathToFileURL(homePath).href}" />
        <div class="stack">
          <img src="${pathToFileURL(agentsPath).href}" />
          <img src="${pathToFileURL(ledgerPath).href}" />
        </div>
      </div>
    </section>
  `);
}

function baseHtml(body) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          width: 1920px;
          height: 1080px;
          overflow: hidden;
          background: #071013;
          color: #eef7f2;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          background:
            linear-gradient(120deg, rgba(72, 187, 120, 0.18), transparent 38%),
            linear-gradient(315deg, rgba(45, 212, 191, 0.16), transparent 42%),
            #071013;
        }
        .center, .slide {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          padding: 86px 104px;
        }
        .center {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .mark, .eyebrow {
          color: #7dd3fc;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0;
          margin: 0 0 24px;
          text-transform: uppercase;
        }
        h1 {
          margin: 0;
          font-size: 92px;
          line-height: 1.02;
          letter-spacing: 0;
          max-width: 1500px;
        }
        h2 {
          margin: 28px 0 0;
          color: #b8f7d4;
          font-size: 54px;
          font-weight: 700;
          letter-spacing: 0;
        }
        p {
          max-width: 1180px;
          color: #c8d8d3;
          font-size: 34px;
          line-height: 1.35;
        }
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 48px;
          margin-bottom: 42px;
        }
        .header h1 {
          font-size: 58px;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 12px;
          max-width: 620px;
        }
        .chips span {
          border: 1px solid rgba(125, 211, 252, 0.45);
          background: rgba(5, 24, 29, 0.82);
          border-radius: 8px;
          color: #d8fff0;
          font-size: 24px;
          font-weight: 700;
          padding: 12px 18px;
          white-space: nowrap;
        }
        .terminal {
          border: 1px solid rgba(184, 247, 212, 0.28);
          border-radius: 8px;
          background: rgba(3, 8, 11, 0.92);
          box-shadow: 0 26px 90px rgba(0, 0, 0, 0.45);
          overflow: hidden;
        }
        .bar {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 58px;
          padding: 0 24px;
          background: rgba(255, 255, 255, 0.06);
          color: #a8bfba;
          font-family: Consolas, "Cascadia Mono", "SFMono-Regular", monospace;
          font-size: 20px;
        }
        .bar span {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ef4444;
        }
        .bar span:nth-child(2) { background: #f59e0b; }
        .bar span:nth-child(3) { background: #22c55e; }
        .bar strong {
          margin-left: 12px;
          font-weight: 600;
        }
        pre {
          margin: 0;
          padding: 32px;
          height: 760px;
          color: #edfdf7;
          font-family: Consolas, "Cascadia Mono", "SFMono-Regular", monospace;
          font-size: 30px;
          line-height: 1.34;
          white-space: pre-wrap;
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.45fr 0.75fr;
          gap: 24px;
          height: 812px;
        }
        .dashboard-grid img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top left;
          border: 1px solid rgba(184, 247, 212, 0.3);
          border-radius: 8px;
          background: #0b1417;
        }
        .stack {
          display: grid;
          grid-template-rows: 1fr 1fr;
          gap: 24px;
          min-height: 0;
        }
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}

function prettyHealth(health, raw) {
  return [
    "$ curl.exe http://127.0.0.1:7822/api/health",
    JSON.stringify({
      status: health.status,
      daemonVersion: health.daemonVersion,
      protocolVersion: health.protocolVersion,
      authRequired: health.authRequired,
      bindMode: health.bindMode
    }, null, 2),
    "",
    "Captured response:",
    stripAnsi(raw)
  ].join("\n");
}

function selectedMetricLines(text) {
  const wanted = new Set(Object.keys(targetMetrics));
  return [
    "$ curl.exe http://127.0.0.1:7823/metrics",
    ...stripAnsi(text)
      .split(/\r?\n/)
      .filter((line) => wanted.has(line.split(/\s+/)[0]))
  ].join("\n");
}

function summarizeCli(text) {
  const lines = stripAnsi(text)
    .split(/\r?\n/)
    .filter((line) => {
      const lower = line.toLowerCase();
      return (
        line.startsWith("$ ") ||
        lower.includes("planner") ||
        lower.includes("researcher") ||
        lower.includes("topic:plan") ||
        lower.includes("topic:research") ||
        lower.includes("commit") ||
        lower.includes("channel") ||
        lower.includes("agent")
      );
    });
  return lines.join("\n");
}

function trimForSlide(text) {
  const lines = stripAnsi(text).split(/\r?\n/).slice(0, 24);
  return lines.map((line) => (line.length > 108 ? `${line.slice(0, 105)}...` : line)).join("\n");
}

async function runCapture(command, args, options) {
  const result = await run(command, args, options);
  const commandLine = `$ ${options.label ?? [command, ...args].join(" ")}`;
  const combined = `${commandLine}\n${stripAnsi(result.stdout)}${stripAnsi(result.stderr)}`.trim();
  if (options.outFile) {
    await fs.writeFile(path.join(outDir, options.outFile), `${combined}\n`);
  }
  if (result.code !== 0) {
    throw new Error(`${options.label ?? command} failed with exit code ${result.code}.\nSee scripts/demo/out/${options.outFile ?? ""}`);
  }
  return { ...result, combined };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...(options.env ?? {}) }
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: 127, stdout, stderr: `${stderr}${error.message}\n` });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function runSyncish(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    shell: false,
    windowsHide: true,
    stdio: "ignore"
  });
}

async function waitFor(fn, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await fn();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Dashboard dev server did not start. Run cd dashboard; npm.cmd install; npm.cmd run dev");
}

async function writeJson(name, value) {
  await fs.writeFile(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function curlCommand() {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function ffmpegPath(file) {
  return path.resolve(file).replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function stripAnsi(text) {
  return String(text).replace(/\u001b\[[0-9;]*m/g, "");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

# Cold-Run Launch Verification

## Summary

- Date/time: 2026-06-04, America/Los_Angeles
- Machine/OS: Microsoft Windows 11 Home, version 10.0.26200, 64-bit
- Clone URL: `https://github.com/sharb1235-hash/attow-nexus`
- Clone path: `C:\Users\Sharb\Documents\attow-nexus-cold-run`
- Clone type: authenticated private GitHub clone
- Source revision tested: `75f8378d508b60146f4576cb61cb6d368ccc5073`
- Public visibility: GitHub reports `PRIVATE`

Verdict:

**PUBLIC CLONE NOT VERIFIED, RE-RUN AFTER REPO VISIBILITY CHANGE**

The authenticated private cold run passed after the fixes listed below. A true anonymous public clone cannot be verified until the repository is made public.

## Hidden-State Checks

- Confirmed missing before first run:
  - `dashboard/node_modules`
  - `sdks/typescript/node_modules`
  - `examples/universal-translation-demo/node_modules`
  - `scripts/demo/node_modules`
  - `scripts/remotion-launch-video/node_modules`
  - Python `.venv`
  - `target`
  - local SQLite databases
  - `.nexus`
- Removed old Nexus Docker resources before testing:
  - legacy `nexus` container
  - cold-run Compose volume `attow-nexus-cold-run_nexus-data`
- Remaining unrelated old volumes were not used by the cold clone:
  - `nexus-clean-test_nexus-data`
  - `nexus_nexus-data`

## Docker Result

Passed.

- `docker compose up --build -d` built and started the daemon.
- `/api/health` returned `status: ok`.
- `/metrics` returned Prometheus text.
- No crash loop was observed.
- Initial run found a global `container_name: nexus` collision with an older container.
- Fix made: removed hardcoded `container_name: nexus` from `docker-compose.yml`.
- Re-run created Compose-scoped container `attow-nexus-cold-run-nexus-1`.

## Setup Script Result

Passed after TypeScript demo dependency fix.

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -NoDashboard
```

The script:

- Checked daemon health.
- Installed the Python SDK with `py -m pip`.
- Ran the LangGraph planner and CrewAI-style researcher.
- Installed the universal TypeScript demo dependencies.
- Built the local TypeScript SDK through the demo `prevercel-demo` hook.
- Ran the Vercel AI SDK-style demo.
- Printed CLI agents/channels/log output.
- Exited successfully without hanging.

Warnings observed:

- Normal `pip` notices about a newer `pip` version.
- Normal first-run Cargo compilation output.

## Dashboard Result

Passed.

Commands:

```powershell
cd dashboard
npm.cmd install
npm.cmd run build
npm.cmd run test:routes
```

Results:

- `npm.cmd install` passed with zero vulnerabilities.
- `npm.cmd run build` passed.
- `npm.cmd run test:routes` passed: 7 tests.
- Vite dev server started and served a page.
- Vite selected `http://127.0.0.1:5174` because another local Vite server was already using `5173`.

## Broken-Agent Recovery Demo Result

Passed.

Command:

```powershell
py examples\broken-agent-recovery\run_demo.py
```

Captured commits from the manual cold run:

- LAST GOOD COMMIT: `c_c3428ab08de3ae16be7f8ea8dff9b022`
- BAD COMMIT: `c_720e410e05853c34e654e9ff240cf534`
- RECOVERY COMMIT: `c_70fb126b338665192f750887888c590a`
- FINAL PASS COMMIT: `c_fe96611a4708595db144fb27cece2eda`

Verified:

- `cargo run -p nexus -- log --run broken-agent-demo`
- `cargo run -p nexus -- diff c_c3428ab08de3ae16be7f8ea8dff9b022 c_720e410e05853c34e654e9ff240cf534`
- `cargo run -p nexus -- replay c_c3428ab08de3ae16be7f8ea8dff9b022`
- `cargo run -p nexus -- replay c_fe96611a4708595db144fb27cece2eda`
- `node scripts\audit\broken-agent-demo-smoke.mjs`

The final replay included `retry_limit: 5`.

## Universal Demo Result

Passed.

Verified:

- `py examples\universal-translation-demo\langgraph_planner.py`
- `py examples\universal-translation-demo\crewai_researcher.py`
- `cd examples\universal-translation-demo`
- `npm.cmd install`
- `npm.cmd run vercel-demo`
- `cargo run -p nexus -- agents`
- `cargo run -p nexus -- channels`
- `cargo run -p nexus -- log --run universal-demo`
- `node scripts\audit\universal-demo-smoke.mjs`

Expected agents appeared:

- `langgraph-planner`
- `crewai-researcher`
- `vercel-ai-frontend`

Expected channels appeared:

- `framework:langgraph:universal-demo`
- `framework:crewai:universal-demo`
- `framework:vercel-ai:universal-demo`

## Validation Summary

Passed:

- `cargo fmt --all -- --check`
- `cargo check --workspace`
- `cargo clippy --workspace -- -D warnings`
- `cargo test --workspace`
- `npx.cmd @bufbuild/buf lint`
- `cd sdks\python; py -m pip install -e .`
- `cd sdks\python; py -m pytest`
- `cd sdks\python; py -m ruff check`
- `cd sdks\typescript; npm.cmd install`
- `cd sdks\typescript; npm.cmd run lint`
- `cd sdks\typescript; npm.cmd run build`
- `cd sdks\typescript; npm.cmd test`
- `cd sdks\typescript; npm.cmd audit`
- `cd dashboard; npm.cmd install`
- `cd dashboard; npm.cmd run lint`
- `cd dashboard; npm.cmd run build`
- `cd dashboard; npm.cmd test`
- `cd dashboard; npm.cmd run test:routes`
- `cd dashboard; npm.cmd audit`
- `node scripts\audit\contract-smoke.mjs`
- `node scripts\audit\auth-smoke.mjs`
- `node scripts\audit\cli-smoke.mjs`
- `node scripts\audit\stress-artifacts.mjs`
- `node scripts\audit\stress-nexus.mjs`
- `node scripts\audit\broken-agent-demo-smoke.mjs`
- `node scripts\audit\universal-demo-smoke.mjs`
- `git diff --check`

## Failures Found

1. `docker-compose.yml` used `container_name: nexus`, which collided with an older Nexus container.
2. `examples/universal-translation-demo/vercel_ai_frontend_agent.ts` imported TypeScript SDK source directly, so cold `npm.cmd install` did not provide SDK dependencies such as `zod`.
3. After switching to package imports, the local TypeScript SDK package needed `dist/` built before the example could import it.

## Fixes Made

- Removed hardcoded `container_name: nexus` from `docker-compose.yml`.
- Changed the universal TypeScript demo imports to use `@nexus-ipc/sdk`.
- Added local file dependency `@nexus-ipc/sdk: file:../../sdks/typescript` to `examples/universal-translation-demo/package.json`.
- Added `prevercel-demo` script to install and build the local TypeScript SDK before running the Vercel-style demo.
- Updated the universal translation demo README to explain that the script builds the local SDK on fresh clones.

## Remaining Warnings

- The repository is still private, so an anonymous public clone has not been verified.
- `pip` printed a normal upgrade notice.
- Vite may choose port `5174` if `5173` is already in use, matching README guidance.
- The audit smoke scripts add repeated demo history if run against an already-used daemon; a fresh `docker compose down -v` gives the cleanest demo story.

## Launch Verdict

**PUBLIC CLONE NOT VERIFIED, RE-RUN AFTER REPO VISIBILITY CHANGE**

Authenticated private cold-run verification passed after the launch-blocking fixes above. Re-run this checklist from an anonymous/public clone before switching from private launch prep to public release confidence.

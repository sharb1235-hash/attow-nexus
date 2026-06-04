# Final Launch Readiness

## Executive Verdict

**Ready for public developer preview after final changes are pushed and GitHub Actions pass on the private repository.**

Attow Nexus is launchable as a local-first developer preview for **Git for AI agent state**. It should not be described as stable production infrastructure.

## What Is Ready

- Local daemon/API/metrics through Docker Compose.
- Python and TypeScript SDKs.
- CLI inspection for status, agents, channels, logs, diff, and replay.
- Vite dashboard dev UI.
- Universal event schema with Python/TypeScript fixture parity.
- `/api/events` canonical ingestion.
- Universal translation demo: one local daemon, one ledger, one CLI, three framework surfaces feeding the same run.
- Broken Agent Recovery demo: bad transition, diff, replay, fixed recovery commit.
- Demo media in `docs/assets/`.
- Security docs for local-first auth, redaction, and Docker exposure nuance.
- Privacy disclosure for local runtime boundaries and optional public launch analytics.
- Launch analytics setup docs for Koala/RB2B, Scarf Gateway, and Common Room.

## What Remains Experimental

- Production dashboard bundling in Docker.
- MCP bridge.
- Local cluster mode.
- Windows named pipe transport.
- RocksDB store.
- OpenTelemetry.
- Encryption-at-rest.
- Deep framework-native checkpointer/store bridges.
- Production remote synchronization.
- Cloud/team features.
- Public web attribution tooling, which must stay outside the local runtime and be disclosed on owned docs/landing pages.

## Commands Run

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
- `docker compose down -v`
- legacy `docker rm -f nexus` cleanup when an older global container existed
- `docker compose up --build -d`
- `curl.exe http://127.0.0.1:7822/api/health`
- `curl.exe http://127.0.0.1:7823/metrics`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -NoDashboard`
- `py examples\broken-agent-recovery\run_demo.py`
- `node scripts\audit\broken-agent-demo-smoke.mjs`
- `node scripts\audit\universal-demo-smoke.mjs`
- `node scripts\audit\contract-smoke.mjs`
- `node scripts\audit\auth-smoke.mjs`
- `node scripts\audit\cli-smoke.mjs`
- `node scripts\audit\stress-artifacts.mjs`
- `node scripts\audit\stress-nexus.mjs`
- `npm.cmd --prefix scripts\demo run demo`
- `ffprobe docs\assets\nexus-demo.mp4`
- Markdown relative link check
- Generated `.env`/SQLite/DB file scan
- Secret-marker scan with expected source/test/doc fixture hits only
- `gh run list --repo sharb1235-hash/attow-nexus --limit 5`
- `git grep --untracked -n -i -E "koala|rb2b|scarf|commonroom|COMMON_ROOM|KOALA|RB2B|SCARF"`
- `git grep --untracked -n -i -E "api_key|secret|token|password"`

Failed locally due workstation policy:

- `.\scripts\setup.ps1 -NoDashboard` was blocked by PowerShell execution policy. The README documents the verified bypass command.

Unavailable locally:

- `gitleaks version` failed because `gitleaks` is not installed on this workstation. The security workflow still includes CI secret scanning.

Fixed during this pass:

- `scripts/audit/auth-smoke.mjs` now waits/retries cleanup so Windows SQLite sidecar files do not cause false smoke failures.
- `scripts/demo/create-demo-video.mjs` now detects the actual Attow Nexus dashboard title instead of attaching to any unrelated Vite server with a `root` div.

## Public Launch Go/No-Go

Go for public developer preview only after:

- Final branch is pushed.
- GitHub Actions are green.
- Attow, Inc. company naming and release approval are complete.
- GitHub private vulnerability reporting or an equivalent disclosure path is enabled.
- Privacy disclosure is reviewed.
- Koala/RB2B, Scarf, and Common Room account setup is completed manually only if Attow chooses to use those launch analytics tools.
- No tracking secrets, OAuth credentials, or private tokens are committed.

## Final Checklist

- [ ] CI green after final push.
- [ ] Attow, Inc. company/provisional decision complete.
- [ ] Optional analytics account setup complete and disclosed.
- [ ] No secrets committed.
- [ ] Repo made public.
- [ ] `v0.1.0` release created.
- [ ] Show HN post ready.

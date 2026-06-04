# Launch Readiness Checklist

## CI

- [ ] GitHub Actions pass on private `sharb1235-hash/attow-nexus`.
- [x] Local Rust format/check/clippy/test passed.
- [x] Local Buf lint passed.
- [x] Local dashboard build passed.
- [x] Local Python SDK tests passed.
- [x] Local TypeScript SDK build/tests passed.
- [x] Python/TypeScript universal fixture parity tests passed.
- [x] Rust daemon universal event ingestion/validation tests passed.
- [x] `node scripts\audit\contract-smoke.mjs` passed against a fresh Docker daemon.
- [x] Dashboard npm audit reviewed/fixed; `npm.cmd audit` reports zero vulnerabilities.
- [x] TypeScript SDK npm audit reviewed/fixed; `npm.cmd audit` reports zero vulnerabilities.
- [ ] `cargo audit` run in CI or locally.

## Clean Clone

- [ ] Run `docs/clean-clone-test.md` from a fresh clone.
- [ ] Confirm repository URL uses `https://github.com/sharb1235-hash/attow-nexus.git`.
- [ ] Confirm `scripts/setup.ps1` and `scripts/setup.sh` are used for the first-run path.
- [ ] Confirm setup scripts assume Docker is already running in Terminal 1.
- [ ] Confirm setup scripts do not require API keys and run the universal demo by default.

## Docker

- [x] `docker compose down -v` completed.
- [x] `docker rm -f nexus` completed.
- [x] `docker compose up --build -d` completed.
- [x] `/api/health` returned `status: ok`.
- [x] `/metrics` returned counters.
- [x] Add or keep docs warning that Docker disables auth inside container and relies on loopback host port publishing.

## SDKs

- [x] Python SDK editable install passed.
- [x] Python SDK tests passed.
- [x] Python demo created two commits.
- [x] `py examples\broken-agent-recovery\run_demo.py` passed against a fresh Docker daemon.
- [x] `node scripts\audit\broken-agent-demo-smoke.mjs` passed against a fresh Docker daemon.
- [x] `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -NoDashboard` passed against a fresh Docker daemon.
- [ ] Direct `.\scripts\setup.ps1 -NoDashboard` depends on local PowerShell execution policy; blocked on this workstation.
- [ ] `./scripts/setup.sh --no-dashboard` passed against a fresh Docker daemon on macOS/Linux or CI.
- [x] TypeScript SDK install/build/test passed.
- [x] TypeScript basic example ran against daemon.
- [x] Clearly label framework adapters as wrapper helpers unless verified with actual frameworks.
- [x] Canonical `UniversalAgentEvent` contract documented and fixture-tested.

## CLI

- [x] `cargo run -p nexus -- status` passed.
- [x] `cargo run -p nexus -- agents` passed.
- [x] `cargo run -p nexus -- channels` passed.
- [x] `cargo run -p nexus -- log --run demo-run` passed.
- [x] `cargo run -p nexus -- diff <commit_a> <commit_b>` passed.
- [x] `cargo run -p nexus -- replay <commit_b>` passed.
- [x] `node scripts\audit\cli-smoke.mjs` passed.

## Dashboard

- [x] `npm.cmd run build` passed.
- [x] Vite dev server was reachable locally.
- [x] Dashboard API client uses real daemon API paths.
- [ ] Manual visual QA after stress with large commit counts.

## Docs

- [x] README title says Attow Nexus.
- [x] README includes `Git for AI agent state.`
- [x] README includes Attow attribution line.
- [x] GitHub URLs point to `sharb1235-hash/attow-nexus`.
- [x] Docker/dashboard wording separates API/metrics from Vite dashboard.
- [x] Clean clone docs use `attow-nexus-clean-test`.
- [x] Review docs for MCP/cluster/adapter overclaims before public launch.

## License / NOTICE

- [x] Apache-2.0 license present.
- [ ] NOTICE file is absent. Not necessarily required, but decide whether Attow wants one.
- [ ] Consider updating copyright holder from `Nexus Contributors` if Attow requires it.

## Demo Asset

- [x] `docs/assets/nexus-demo.mp4` exists.
- [x] MP4 is non-empty.
- [x] MP4 duration verified as 45 seconds.
- [x] Demo pipeline ran successfully.
- [x] Dashboard scene preview shows populated Console panels with no broken image boxes.

## Security

- [x] Basic secret grep found no real committed secrets.
- [x] Redaction code and tests exist.
- [x] Remote bind guard exists and is tested.
- [x] npm audit findings resolved for dashboard and TypeScript SDK.
- [ ] `cargo audit` not run locally in this final pass; security workflow installs it.
- [x] CI secret scanning added with gitleaks.
- [ ] Remote use needs explicit review.

## Release

- [ ] Keep repository private until CI is green.
- [ ] Resolve/disclose P0/P1 audit findings.
- [ ] Tag `v0.1.0` only after clean clone test passes.
- [ ] Publish packages only on manual release trigger if intended.

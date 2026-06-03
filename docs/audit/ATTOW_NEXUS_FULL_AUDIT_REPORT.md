# Attow Nexus Full Audit Report

Audit date: 2026-06-03  
Repository path audited: `C:\Users\Sharb\Documents\Codex\2026-06-01\you-are-codex-build-a-complete\nexus`

## Executive Summary

Attow Nexus has a real working MVP core: Docker starts the Rust daemon/API, the Python demo creates durable commits, the CLI can inspect agents/channels/logs/diff/replay, metrics counters reflect runtime activity, the dashboard builds and can read real daemon data through Vite, and the demo-video pipeline creates a real MP4 from captured outputs. The v0.1 adapter story is now centered on a credible developer-preview claim: one local daemon, one ledger, one CLI, and three framework surfaces feeding the same run. The serialization contract has shared Python/TypeScript fixtures, golden outputs, malformed-input tests, and daemon ingestion validation.

The codebase is not ready to be described as a complete production-grade state substrate. Several surfaces are partial or experimental: MCP bridge, local cluster mode, framework adapters, Windows named pipe transport, dashboard action pages, auth/permission depth, release automation, and broad CI/runtime coverage. Previous npm audit blockers for the dashboard and TypeScript SDK were resolved through controlled upgrades.

## Overall Verdict

**READY FOR PUBLIC DEV PREVIEW after the current remediation changes are pushed and CI passes. NOT READY for stable production launch.**

The product can be launched honestly as an early local-first developer preview if:

- The current remediation changes pass GitHub Actions on the private repository.
- README/docs keep experimental features clearly labeled.
- The repository remains private until GitHub Actions pass on the renamed `sharb1235-hash/attow-nexus` repo.

## What Is Real And Verified

- Docker Compose builds and starts the daemon container.
- HTTP API health endpoint returns `status: ok`.
- Metrics endpoint returns Prometheus-style counters.
- Python SDK editable install works.
- Python demo creates two durable commits.
- CLI `status`, `agents`, `channels`, `log`, `diff`, and `replay` work against the Docker daemon.
- Rust daemon tests cover registration, durable and ephemeral publish, diff, replay, fork, rollback, redaction, artifact storage, basic DAG cycle rejection, backpressure, and remote-bind rejection.
- Dashboard TypeScript build succeeds.
- Dashboard dev server starts and serves Vite locally.
- Dashboard API client points at real daemon endpoints through Vite proxy, not mock data.
- Demo video pipeline creates `docs/assets/nexus-demo.mp4` from real captured outputs.
- Local stress script created 10, 100, and 500 durable commits through the HTTP API and verified CLI log output.
- LangGraph, CrewAI-style, and Vercel AI SDK-style wrapper adapters translate into a shared `UniversalAgentEvent` schema for `run_id=universal-demo`.
- Canonical universal event fixtures cover valid events, parent chains, large payload behavior, redaction, and malformed inputs.
- `POST /api/events` accepts canonical snake_case `UniversalAgentEvent` JSON and turns it into durable commits through the same ledger path.

## What Is Partial

- NexusLedger DAG works for explicit parent chains. The basic Python demo now links the researcher commit to the planner commit; independent roots in the same run still do not replay as one combined timeline.
- Diff is a JSON-like payload diff plus shallow metadata/count comparisons. It is useful, but not a full semantic commit diff.
- Replay reconstructs captured logical state by merging ancestry payloads. It does not replay messages in the demo and does not execute tools by default.
- Replay follows parent commit ancestry. The fixture parent-chain test verifies parent and child event state merge when payloads are inline; artifact-backed replay remains limited by current artifact handling.
- Fork sets a new run head and records an event, but branch UX and follow-on fork commit semantics are minimal.
- Rollback moves a head pointer and records an event, but runtime dashboard rollback flow is basic.
- Dashboard pages exist for diff/replay/fork/rollback, but they are form-based MVP controls rather than polished guided workflows.
- Python and TypeScript SDK tests use fake or local HTTP-style clients for most assertions; only examples exercise a live daemon.
- The LangGraph Python adapter now has verified public-surface compiled graph wrapper tests and a real no-LLM LangGraph example. It is still not a deep checkpointer/store bridge.
- The CrewAI Python adapter has fake crew wrapper tests and public `step_callback` composition. It is not yet verified against a pinned CrewAI package.
- The Vercel AI SDK TypeScript adapter has fake `generateText`/`streamText` tests and preserves callbacks. It is not yet verified against a pinned `ai` package in CI.
- AutoGen/Microsoft Agent Framework adapters remain public wrapper helpers, not verified deep integrations with actual framework packages.
- Security model is local-first/dev-first; Docker disables auth inside the container and relies on loopback host port publishing.

## What Is Documentation-Only Or Experimental

- MCP bridge exposes local tool/resource names in code, but no full MCP server runtime handshake was verified.
- Local cluster mode is structural/config-only and should be treated as experimental.
- Windows named pipe support is represented as configuration plus documented TCP fallback, not an implemented named pipe server.
- RocksDB store feature is gated and returns a clear error when requested without the feature; no RocksDB implementation was verified.
- OpenTelemetry and encryption-at-rest flags exist in config, but no complete runtime implementation was verified.
- Framework-specific adapters other than the LangGraph public-surface wrapper are not verified against real framework versions.

## Architecture Overview

The daemon is a Rust Tokio/Axum/Tonic application with these core paths:

- HTTP API routes in `daemon/src/http/api.rs`.
- gRPC service implementation in `daemon/src/grpc/service.rs`.
- In-memory bus and presence/channel registries in `daemon/src/bus`.
- SQLite-backed durable store in `daemon/src/ledger/sqlite_store.rs`.
- DAG index in `daemon/src/ledger/dag.rs`.
- Diff/replay/fork/rollback helpers in `daemon/src/ledger`.
- Redaction in `daemon/src/security/redaction.rs`.
- Metrics in `daemon/src/observability/metrics.rs`.

The CLI uses the HTTP API. The Python and TypeScript SDKs also use HTTP API paths for the current MVP even though gRPC dependencies/protobufs exist.

## Runtime Verification Evidence

Clean Docker runtime was started with:

```powershell
docker compose down -v
docker rm -f nexus
docker compose up --build -d
```

Health endpoint returned:

```json
{"authRequired":false,"bindMode":"tcp","daemonVersion":"0.1.0","localOnly":false,"protocolVersion":"nexus.v1","status":"ok"}
```

Initial metrics returned all zero counters. Python demo then returned:

```text
created commits: c_fb4b5bb2d7051bc3cdcb7e7f0ad08b69 c_381eba00e5c5d23a723e17fa41927e3d
```

CLI verification succeeded for:

- `cargo run -p nexus -- status`
- `cargo run -p nexus -- agents`
- `cargo run -p nexus -- channels`
- `cargo run -p nexus -- log --run demo-run`
- `cargo run -p nexus -- diff c_fb4b5bb2d7051bc3cdcb7e7f0ad08b69 c_381eba00e5c5d23a723e17fa41927e3d`
- `cargo run -p nexus -- replay c_381eba00e5c5d23a723e17fa41927e3d`

Post-demo metrics showed:

```text
nexus_agents_connected 2
nexus_channels_total 2
nexus_deltas_total 2
nexus_durable_deltas_total 2
nexus_commits_total 2
```

After CLI/artifact/stress smoke scripts, metrics showed 617 durable deltas/commits and zero daemon errors. The final demo-video run resets Docker back to the clean two-commit story.

## Command Ledger

Passed:

- `cargo fmt --all -- --check`
- `cargo check --workspace`
- `cargo clippy --workspace -- -D warnings`
- `cargo test --workspace`
- `npx.cmd @bufbuild/buf lint`
- `cd dashboard; npm.cmd install`
- `cd dashboard; npm.cmd run build`
- `cd sdks\python; py -m pip install -e .`
- `cd sdks\python; py -m pytest`
- `cd sdks\typescript; npm.cmd install`
- `cd sdks\typescript; npm.cmd run build`
- `cd sdks\typescript; npm.cmd test`
- `docker compose down -v`
- `docker rm -f nexus`
- `docker compose up --build -d`
- `curl.exe http://127.0.0.1:7822/api/health`
- `curl.exe http://127.0.0.1:7823/metrics`
- `py examples\python-basic\main.py`
- `cargo run -p nexus -- status`
- `cargo run -p nexus -- agents`
- `cargo run -p nexus -- channels`
- `cargo run -p nexus -- log --run demo-run`
- `cargo run -p nexus -- diff c_fb4b5bb2d7051bc3cdcb7e7f0ad08b69 c_381eba00e5c5d23a723e17fa41927e3d`
- `cargo run -p nexus -- replay c_381eba00e5c5d23a723e17fa41927e3d`
- dashboard Vite dev server probe through `npm.cmd run dev`
- `npm.cmd --prefix scripts\demo install`
- `npm.cmd --prefix scripts\demo run demo`
- `node scripts\audit\stress-nexus.mjs`
- `cd examples\typescript-basic; npm.cmd install`
- `cd examples\typescript-basic; npm.cmd run start`
- `git diff --check`

Previously failed and now fixed:

- `cd dashboard; npm.cmd audit` now reports zero vulnerabilities after controlled upgrades.
- `cd sdks\typescript; npm.cmd audit` now reports zero vulnerabilities after controlled upgrades.

Failed or not available:

- `cargo audit` was not available locally because `cargo-audit` is not installed; `cargo install cargo-audit` timed out after five minutes.

## Major Risks

1. Docker health reports `localOnly: false` because the daemon binds `0.0.0.0` inside the container, even though host ports are published only on `127.0.0.1`.
2. Docker Compose sets `NEXUS_REQUIRE_AUTH=false` and `NEXUS_ALLOW_REMOTE=true`; this is acceptable only because host port bindings are loopback-only and docs explain the nuance.
3. Framework adapters are wrappers. LangGraph, CrewAI-style, and Vercel AI SDK-style surfaces now share a canonical event schema, but no adapter is a private-internals deep framework integration.
4. Dashboard has MVP forms and polling, not a finished operator console.
5. MCP/cluster/Windows named pipe claims must remain experimental.
6. Recent GitHub CI runs are green on the renamed private repository, but these remediation changes still need CI after push.
7. `cargo audit` was not run locally because `cargo-audit` is not installed; the install attempt timed out.
8. Rust tests are useful but small: daemon coverage exists, but CLI unit/snapshot tests are still missing.
9. Replay/DAG behavior depends on parent links. Independent root commits in the same run do not replay as one combined run timeline.
10. The universal contract is now fixture-tested across Python and TypeScript, but future language SDKs must adopt the same fixture/golden suite before being marketed as compatible.

## Recommended Launch Decision

Launch as **public developer preview** only after:

- GitHub Actions pass on the private renamed repository after these remediation commits are pushed.
- README and docs continue to label MCP, cluster, framework adapters, and Docker dashboard bundling as experimental/partial.

Do not present Attow Nexus as production-ready or stable v1.0.

# Security Review

## Local-First Security Posture

The default non-Docker configuration is local-first:

- `NEXUS_GRPC_ADDR`, `NEXUS_HTTP_ADDR`, and `NEXUS_METRICS_ADDR` default to `127.0.0.1`.
- `NEXUS_REQUIRE_AUTH` defaults to `true`.
- `NEXUS_ALLOW_REMOTE` defaults to `false`.
- Config validation rejects non-loopback binds unless `NEXUS_ALLOW_REMOTE=true`.
- TCP mode requires `NEXUS_AUTH_TOKEN` unless auth is explicitly disabled.

Evidence:

- `daemon/src/config.rs`
- Rust test `dag_rejects_cycles_and_remote_bind_is_rejected`

## Docker Exposure

Docker Compose intentionally sets:

```yaml
NEXUS_REQUIRE_AUTH: "false"
NEXUS_ALLOW_REMOTE: "true"
NEXUS_GRPC_ADDR: 0.0.0.0:7821
NEXUS_HTTP_ADDR: 0.0.0.0:7822
NEXUS_METRICS_ADDR: 0.0.0.0:7823
```

Host port mappings are loopback-only:

```yaml
"127.0.0.1:7821:7821"
"127.0.0.1:7822:7822"
"127.0.0.1:7823:7823"
```

Runtime health reports `localOnly: false` because the daemon itself binds `0.0.0.0` inside the container. Host exposure is still loopback-only. This needs to remain clearly documented because a user modifying the port mapping could expose an unauthenticated daemon.

## Auth Behavior

HTTP and gRPC token validation exist. Local development can disable auth. Permission scopes exist in code, but the MVP permission model is simple and not deeply exercised by runtime tests.

Status: **PARTIAL**

Recommended public-launch stance: local-only/dev-first, do not recommend remote use without review.

## Secret Scanning

A repository text scan for common secret markers found no committed real secrets. Matches were expected source/test/doc references for redaction and auth handling.

Patterns scanned included:

- `api_key`
- `secret`
- `token`
- private key markers
- `ghp_`
- `github_pat`
- `AKIA`
- `sk-`
- database URL password patterns

## Redaction

Redaction exists in:

- `daemon/src/security/redaction.rs`
- `sdks/python/nexus_ipc/redaction.py`
- `sdks/typescript/src/redaction.ts`

Tests passed:

- Rust redaction/artifact test.
- Python redaction tests.
- TypeScript redaction tests.
- Cross-language universal redaction fixture tests.
- Daemon universal event ingestion test verifies persisted fixture data does not include the original `api_key`, bearer token, or password.

Status: **VERIFIED for common patterns, not exhaustive DLP.**

## Dependency Audit

### Dashboard

Command:

```powershell
cd dashboard
npm.cmd audit
```

Result: **PASSED**

Summary:

- Controlled upgrades were applied for Vite, Vitest, and `@vitejs/plugin-react`.
- `npm.cmd audit` reports `found 0 vulnerabilities`.

### TypeScript SDK

Command:

```powershell
cd sdks\typescript
npm.cmd audit
```

Result: **PASSED**

Summary:

- Controlled upgrades were applied for Vitest and tsup.
- `npm.cmd audit` reports `found 0 vulnerabilities`.

### Rust

Command:

```powershell
cargo audit
```

Result: **NOT RUN**

Reason:

```text
error: no such command: `audit`
```

An attempted local `cargo install cargo-audit` exceeded the five-minute command timeout and did not install the subcommand. The GitHub security workflow installs `cargo-audit`, and `just audit`/`make audit` now provide a local path once `cargo-audit` is installed.

## CORS / Dashboard Assumptions

The HTTP API uses permissive CORS. This is convenient for local development, but it reinforces that remote exposure must not be enabled casually. Dashboard dev mode relies on Vite proxy/local requests.

Status: **P1 review before remote use.**

## Required Fixes Before Public Launch

1. Keep Docker host ports loopback-only and document that changing them can expose an unauthenticated daemon.
2. Avoid any claim that Docker health `localOnly: false` means remote-safe operation.
3. Run `cargo audit` locally after installing `cargo-audit`, or rely on the GitHub security workflow before public release.

## Recommended Fixes After Launch

- Add a documented auth-enabled Docker Compose profile.
- Keep CI secret scanning enabled with gitleaks.
- Add HTTP API integration tests for auth-required mode.
- Reduce permissive CORS or gate it by local/dev config.
- Add a real permission-file test path.
- Add dependency audit triage notes to SECURITY.md.

# Remediation Plan

## P0 Launch Blockers

1. **Resolve or explicitly accept npm audit failures.** - DONE
   - Dashboard and TypeScript SDK advisories were handled with controlled upgrades, not `npm audit fix --force`.
   - Dashboard now uses Vite 8, Vitest 4, and `@vitejs/plugin-react` 6.
   - TypeScript SDK now uses Vitest 4 and tsup 8.5.
   - `npm.cmd audit` currently reports `found 0 vulnerabilities` for both packages.

2. **Confirm GitHub Actions on the renamed private repository.** - PARTIAL
   - `gh run list --repo sharb1235-hash/attow-nexus --limit 10` shows recent successful CI runs.
   - These remediation changes still need to be pushed and must pass CI before the repo is made public.

## P1 Should Fix Before Public Launch

1. **Document Docker auth/exposure nuance more explicitly.** - DONE
   - Docker binds `0.0.0.0` inside the container with auth disabled.
   - Host port mappings are loopback-only.
   - Make clear that changing port bindings can expose captured context.

2. **Label framework adapters as wrapper helpers.** - DONE
   - Python/TypeScript adapters are public wrapper helpers.
   - They are not verified deep integrations with actual framework packages.

3. **Clarify replay semantics.** - DONE
   - Replay follows commit ancestry.
   - It does not merge all independent roots in a run unless parent links connect them.

4. **Clarify MCP and local cluster status.** - DONE
   - MCP bridge and local cluster mode are experimental.
   - Current code provides descriptors/config stubs, not full verified runtime systems.

5. **Add auth-enabled runtime smoke test.** - DONE
   - `scripts/audit/auth-smoke.mjs` verifies `NEXUS_REQUIRE_AUTH=true` with a token for HTTP and CLI.
   - Python and TypeScript SDK tests assert bearer token headers are sent.

6. **Add dashboard route smoke tests with real mocked API fixtures.** - DONE
   - `dashboard/src/routes.test.tsx` renders the main dashboard route shells and metrics fixture.

## P2 Shortly After Public Launch

1. Add CLI unit/snapshot tests.
2. Add HTTP API integration tests for all public endpoints.
3. Add runtime tests for CLI `fork`, `rollback`, `export`, and `doctor`. - DONE as local smoke script in `scripts/audit/cli-smoke.mjs`; still worth converting to CI.
4. Add artifact stress test with payloads above `NEXUS_MAX_INLINE_PAYLOAD_BYTES`. - DONE as local smoke script in `scripts/audit/stress-artifacts.mjs`; still worth converting to CI.
5. Add subscriber/backpressure runtime test with real HTTP/SSE or gRPC stream where feasible.
6. Add dashboard manual QA script or Playwright smoke test.
7. Add CI secret scanning. - DONE in `.github/workflows/security.yml` with gitleaks.
8. Add `cargo audit` to local dev docs or `just audit`. - DONE in `justfile` and `Makefile`; local machine still needs `cargo install cargo-audit`.

## P3 Roadmap

1. Implement real Windows named pipe transport or keep it documented as fallback-only.
2. Implement or remove RocksDB store claims until real feature support exists.
3. Expand MCP bridge to a full tested MCP server integration.
4. Build real local cluster forwarding or keep local cluster experimental.
5. Add richer metrics: histograms for latency and gauges for memory/artifact storage.
6. Add production dashboard bundle path if Docker should eventually serve the console.
7. Add role/scoped permission file tests and UI visibility.

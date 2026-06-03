# Attow Nexus Audit Stress Script

This directory contains a lightweight local smoke/stress test for the Attow Nexus daemon.

It is intentionally not a production benchmark. It creates real durable checkpoint commits through the local HTTP API, records elapsed time and approximate commits/sec, checks metrics before and after each run, and verifies that the `nexus` CLI can still read the resulting run log.

## Prerequisites

Start the daemon first:

```powershell
docker compose up --build
```

For a cleaner audit run, use a fresh data volume:

```powershell
docker compose down -v
docker compose up --build
```

## Run

From the repository root:

```powershell
node scripts/audit/stress-nexus.mjs
```

Auth-required smoke:

```powershell
node scripts/audit/auth-smoke.mjs
```

CLI command smoke against a running daemon:

```powershell
node scripts/audit/cli-smoke.mjs
```

Artifact threshold smoke against a running daemon:

```powershell
node scripts/audit/stress-artifacts.mjs
```

Optional custom levels:

```powershell
node scripts/audit/stress-nexus.mjs --levels 10,100,500
```

The script uses only local loopback endpoints:

- `http://127.0.0.1:7822/api/health`
- `http://127.0.0.1:7822/api/agents/register`
- `http://127.0.0.1:7822/api/checkpoint`
- `http://127.0.0.1:7823/metrics`

Raw results are printed to stdout and can be copied into `docs/audit/STRESS_TEST_REPORT.md`.

# Stress Test Report

## Commands Run

```powershell
node scripts\audit\stress-nexus.mjs
```

Prerequisite runtime was a Docker daemon started with:

```powershell
docker compose down -v
docker rm -f nexus
docker compose up --build -d
```

The Python demo plus CLI/artifact smoke scripts were run before this stress script, so the stress baseline began with existing local audit activity rather than an empty daemon.

## Dataset / Commit Counts

The audit script created three isolated runs:

- `audit-stress-10-1780471618931`
- `audit-stress-100-1780471619936`
- `audit-stress-500-1780471621424`

Each run used one local HTTP agent and durable checkpoints on a per-level channel.

## Results

| Level | Elapsed ms | Approx commits/sec | Last commit ID | CLI log verified |
|---:|---:|---:|---|---|
| 10 | 128.72 | 77.69 | `c_a2e08d8191f7d60bb2b922cc0c107169` | yes |
| 100 | 711.98 | 140.45 | `c_fa43259b7a3e524511c156771cfcdfe1` | yes |
| 500 | 3611.56 | 138.44 | `c_ee8785408878e0c0d14cb182ab172be2` | yes |

Metrics after the 500-commit level:

```text
nexus_agents_connected 5
nexus_channels_total 7
nexus_deltas_total 617
nexus_durable_deltas_total 617
nexus_commits_total 617
nexus_errors_total 0
```

The separate artifact stress smoke created one large-payload artifact and verified `nexus_artifacts_total` increased from 0 to 1.

## Failure Points

No stress-script runtime failures were observed.

## Bottlenecks / Caveats

- This was a local smoke/stress test on one Windows workstation, not a controlled benchmark.
- Checkpoints were sent sequentially, not concurrently.
- The main stress test used JSON payloads small enough to remain inline. Artifact threshold behavior is covered by `scripts/audit/stress-artifacts.mjs`, not this throughput smoke.
- Metrics are simple counters. There are no p50/p95/p99 latency histograms from daemon-side telemetry in this run.
- `cargo run` CLI verification includes Cargo startup/build overhead and is not representative of installed binary latency.

## What This Proves

- The HTTP checkpoint path can create at least 610 durable commits during the stress levels without daemon errors.
- SQLite persistence, metrics counters, and CLI run-log retrieval continued working after the 500-commit run.
- The daemon remained responsive to health/metrics checks during the audit.

## What This Does Not Prove

- Production throughput.
- Concurrent multi-agent load behavior.
- Long-running memory stability.
- Sustained large artifact throughput beyond the single threshold smoke.
- Backpressure behavior under high subscriber load.
- Remote deployment safety.
- Dashboard behavior with very large histories.

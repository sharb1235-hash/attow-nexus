# Benchmarks

Run benchmarks locally:

```bash
nexus bench local --events 10000 --payload-size 4096
```

Reports include p50, p95, and p99 publish latency; durable checkpoint latency sampling; deltas per second; commits per second; artifact throughput guidance; and memory usage pointers.

Do not publish benchmark numbers without including hardware, OS, daemon config, storage backend, payload size, event count, and whether auth/redaction/compression were enabled.


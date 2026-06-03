# Public Launch Checklist

Use this checklist before making the Attow Nexus GitHub repository public.

- [ ] Keep `sharb1235-hash/attow-nexus` private until CI passes.
- [ ] Confirm GitHub Actions are green.
- [ ] Run the private CI verification commands in [private-ci-verification.md](private-ci-verification.md).
- [ ] Run a clean clone test.
- [ ] Confirm Docker Compose starts.
- [ ] Confirm `/api/health` works.
- [ ] Confirm `/metrics` works.
- [ ] Confirm Python demo works.
- [ ] Confirm CLI `status`, `agents`, `channels`, and `log` work.
- [ ] Confirm dashboard opens from Vite.
- [ ] Record demo GIF/MP4.
- [ ] Review README for overclaims.
- [ ] Confirm MCP bridge, local cluster mode, Windows named pipe transport, RocksDB store, framework adapters, OpenTelemetry, and encryption-at-rest are labeled experimental or unverified where applicable.
- [ ] Only then switch repo visibility to public.
- [ ] Create the `v0.1.0` release.

The Attow Nexus repository should stay private until the clean clone, CI, Docker, demo, CLI, metrics, and dashboard checks all pass.

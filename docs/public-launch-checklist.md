# Public Launch Checklist

Use this checklist before making the Attow Nexus GitHub repository public.

- [ ] Keep `sharb1235-hash/attow-nexus` private until CI passes.
- [ ] Confirm GitHub Actions are green.
- [ ] Run the private CI verification commands in [private-ci-verification.md](private-ci-verification.md).
- [ ] Run a clean clone test.
- [ ] Confirm Docker Compose starts.
- [ ] Confirm `/api/health` works.
- [ ] Confirm `/metrics` works.
- [ ] Confirm `.\scripts\setup.ps1 -NoDashboard` works on Windows against Docker already running in Terminal 1.
- [ ] Confirm `./scripts/setup.sh --no-dashboard` works on macOS/Linux against Docker already running in Terminal 1.
- [ ] Confirm the setup scripts require no API keys and run the universal demo by default.
- [ ] Confirm Python demo works if using the `-Basic` / `--basic` fallback path.
- [ ] Confirm CLI `status`, `agents`, `channels`, and `log` work.
- [ ] Confirm dashboard opens from Vite.
- [ ] Confirm the README quickstart still says Docker runs daemon/API/metrics and the dashboard runs separately from Vite.
- [ ] Record demo GIF/MP4.
- [ ] Review README for overclaims.
- [ ] Confirm MCP bridge, local cluster mode, Windows named pipe transport, RocksDB store, framework adapters, OpenTelemetry, and encryption-at-rest are labeled experimental or unverified where applicable.
- [ ] Only then switch repo visibility to public.
- [ ] Create the `v0.1.0` release.

The Attow Nexus repository should stay private until the clean clone, CI, Docker, demo, CLI, metrics, and dashboard checks all pass.

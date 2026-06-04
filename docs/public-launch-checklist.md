# Public Launch Checklist

Use this checklist before making the Attow Nexus GitHub repository public.

- [ ] Keep `sharb1235-hash/attow-nexus` private until CI passes.
- [ ] Confirm GitHub Actions are green.
- [ ] Review [company-launch-checklist.md](company-launch-checklist.md) for Attow, Inc. operational readiness.
- [ ] Run the private CI verification commands in [private-ci-verification.md](private-ci-verification.md).
- [ ] Run a clean clone test.
- [ ] Run or review [cold-run-launch-verification.md](cold-run-launch-verification.md).
- [ ] Confirm Docker Compose starts.
- [ ] Confirm `/api/health` works.
- [ ] Confirm `/metrics` works.
- [ ] Confirm `.\scripts\setup.ps1 -NoDashboard` works on Windows against Docker already running in Terminal 1.
- [ ] Confirm `./scripts/setup.sh --no-dashboard` works on macOS/Linux against Docker already running in Terminal 1.
- [ ] Confirm the setup scripts require no API keys and run the universal demo by default.
- [ ] Confirm Python demo works if using the `-Basic` / `--basic` fallback path.
- [ ] Confirm CLI `status`, `agents`, `channels`, and `log` work.
- [ ] Confirm Broken Agent Recovery demo and smoke script work.
- [ ] Confirm dashboard opens from Vite.
- [ ] Confirm the README quickstart still says Docker runs daemon/API/metrics and the dashboard runs separately from Vite.
- [ ] Verify committed demo MP4/GIF assets render correctly.
- [ ] Review README for overclaims.
- [ ] Confirm SECURITY.md has a real disclosure path or GitHub private vulnerability reporting enabled.
- [ ] Confirm [PRIVACY.md](../PRIVACY.md) is linked from the README.
- [ ] Confirm Koala/RB2B account is created only if using a web pixel.
- [ ] Confirm any pixel is installed only on an owned docs/landing site, not the local dashboard.
- [ ] Confirm Scarf Gateway link is created only if using tracked setup links.
- [ ] Confirm the direct `setup.sh` fallback remains documented.
- [ ] Confirm Common Room GitHub integration is connected if using community tracking.
- [ ] Confirm launch analytics docs contain only placeholders and no secrets.
- [ ] Confirm MCP bridge, local cluster mode, Windows named pipe transport, RocksDB store, framework adapters, OpenTelemetry, and encryption-at-rest are labeled experimental or unverified where applicable.
- [ ] Only then switch repo visibility to public.
- [ ] Create the `v0.1.0` release.

The Attow Nexus repository should stay private until the clean clone, CI, Docker, demo, CLI, metrics, dashboard, privacy, and analytics disclosure checks all pass.

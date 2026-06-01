# Public Launch Checklist

Use this checklist before making the GitHub repository public.

- [ ] Keep GitHub repo private until CI passes.
- [ ] Confirm GitHub Actions are green.
- [ ] Run a clean clone test.
- [ ] Confirm Docker Compose starts.
- [ ] Confirm `/api/health` works.
- [ ] Confirm `/metrics` works.
- [ ] Confirm Python demo works.
- [ ] Confirm CLI `status`, `agents`, `channels`, and `log` work.
- [ ] Confirm dashboard opens from Vite.
- [ ] Record demo GIF/MP4.
- [ ] Review README for overclaims.
- [ ] Only then switch repo visibility to public.
- [ ] Create the `v0.1.0` release.

The repository should stay private until the clean clone, CI, Docker, demo, CLI, metrics, and dashboard checks all pass.

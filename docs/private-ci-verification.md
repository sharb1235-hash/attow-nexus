# Private CI Verification

Keep `sharb1235-hash/attow-nexus` private until GitHub Actions are green on the renamed repository.

## Check Runs

From a machine with the GitHub CLI authenticated:

```powershell
gh run list --repo sharb1235-hash/attow-nexus --limit 10
gh run view --repo sharb1235-hash/attow-nexus --log-failed
```

Expected before public launch:

- `ci.yml` passes.
- `security.yml` passes or has only explicitly accepted non-blocking advisories.
- `release.yml` can be manually dispatched or dry-reviewed for `v0.1.0`.
- The default branch badge points to `sharb1235-hash/attow-nexus`.

Do not make the repository public until the latest commit on the private repository has green CI.

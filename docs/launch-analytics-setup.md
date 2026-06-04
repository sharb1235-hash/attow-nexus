# Launch Analytics Setup

This checklist prepares launch attribution and community tracking without adding hidden telemetry to the Attow Nexus local runtime.

## A. What We Track

- Public docs or landing page visitors through Koala or RB2B.
- Install/setup traffic through Scarf Gateway links.
- GitHub stars, forks, issues, pull requests, discussions, and comments through Common Room GitHub integration where available.

## B. What We Do Not Track

- No daemon runtime telemetry.
- No SDK runtime telemetry.
- No CLI telemetry.
- No local agent state leaving the machine.
- No hidden postinstall tracking.
- No secrets committed to the repository.

## C. Manual Account Setup

Codex must not handle passwords, OAuth login, OAuth consent, Google account credentials, GitHub account credentials, or secret tokens. The founder should complete account setup manually and approve OAuth scopes directly.

### Koala

- Create the Koala account manually.
- Prefer "Sign up with Google" if available.
- Use `sharb1235@gmail.com`.
- Copy the Koala pixel snippet after account creation.
- Store snippet IDs in environment/config, not as committed secrets if applicable.
- Install the pixel only on an owned docs or landing page with a privacy disclosure.

### RB2B

- Create the RB2B account manually if choosing RB2B instead of Koala.
- Prefer "Sign up with Google" if available.
- Use `sharb1235@gmail.com`.
- Authorize the landing/docs domain.
- Copy the RB2B tracking script.
- Add it only to owned docs/landing pages with privacy disclosure.

### Scarf

- Create the Scarf account manually.
- Prefer "Sign up with Google" if available.
- Use `sharb1235@gmail.com`.
- Create a Gateway/File package for `scripts/setup.sh` or a stable installer URL.
- Point the Scarf Gateway target to the raw GitHub URL for `scripts/setup.sh` after the repo is public:
  `https://raw.githubusercontent.com/sharb1235-hash/attow-nexus/main/scripts/setup.sh`
- Record the Scarf URL in this document when created:
  `SCARF_SETUP_SH_URL=<paste after Scarf Gateway created>`
- Keep the direct GitHub/raw fallback in the README.

### Common Room

- Create the Common Room account manually.
- Prefer "Sign up with Google" if available.
- Use `sharb1235@gmail.com`.
- Connect GitHub repository `sharb1235-hash/attow-nexus`.
- Grant only required GitHub scopes.
- Confirm it is ingesting stargazers, forks, issues, pull requests, discussions, and comments if available.

## D. Launch Day Verification

- Visit the docs/landing page and verify the selected pixel fires.
- Click the Scarf setup URL and verify a hit appears.
- Star the repo from a test account, or wait for first stars, and confirm Common Room ingestion.
- Confirm no secrets are committed.

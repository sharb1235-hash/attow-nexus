# Security Policy

## Supported Versions

Security updates are provided for the latest minor release. During the pre-1.0 period, upgrade to the newest available release before reporting whether an issue still reproduces.

## Reporting a Vulnerability

Use GitHub private vulnerability reporting for `sharb1235-hash/attow-nexus` while the project is in developer preview. Include the affected version, operating system, reproduction steps, and whether a secret or external side effect was involved.

If Attow, Inc. later designates a security inbox, add it here before advertising email-based disclosure.

## Local-Only Defaults

Attow Nexus is designed for local-first operation. The daemon rejects non-loopback TCP binds unless `NEXUS_ALLOW_REMOTE=true`. TCP mode requires a bearer token by default.

## Secret Redaction

SDKs and the daemon redact common secrets before payloads are sent, broadcast, or persisted. Detection covers API keys, bearer tokens, private keys, PEM blocks, AWS access keys, GitHub tokens, OpenAI-style keys, Anthropic-style keys, JWTs, database URLs with passwords, and generic secret key names.

## Remote Bind Risks

Remote binding can expose captured context and ledger history. Use token management, least-privilege scopes, network controls, and deployment-specific monitoring before enabling it.

The Docker Compose demo sets `NEXUS_REQUIRE_AUTH=false` and `NEXUS_ALLOW_REMOTE=true` inside the container so the daemon can bind container interfaces, but host ports are published on `127.0.0.1` only. Changing those host port bindings can expose an unauthenticated local-dev daemon.

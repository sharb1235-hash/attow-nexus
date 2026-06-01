# Security

Nexus is local-first. Default daemon binding is local-only, and non-loopback TCP bind is rejected unless `NEXUS_ALLOW_REMOTE=true`.

TCP mode requires bearer token auth by default. Local development can set `NEXUS_REQUIRE_AUTH=false`.

UDS sockets are restricted to the current user on Unix-like systems.

SDKs redact secrets before sending payloads. The daemon redacts again before broadcasting and persistence.

Never log secrets. Nexus logs structured context such as run ID, agent ID, channel, and commit ID.

Responsible disclosure details are in `SECURITY.md`.


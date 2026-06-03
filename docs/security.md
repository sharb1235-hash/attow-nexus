# Security

Attow Nexus is local-first. Default daemon binding is local-only, and non-loopback TCP bind is rejected unless `NEXUS_ALLOW_REMOTE=true`.

TCP mode requires bearer token auth by default. Local development can set `NEXUS_REQUIRE_AUTH=false`.

Docker Compose is a local demo profile: it disables auth inside the container and binds daemon services to container `0.0.0.0`, while publishing host ports only on `127.0.0.1`. Do not publish those ports on a public interface without enabling auth and reviewing exposure.

UDS sockets are restricted to the current user on Unix-like systems.

SDKs redact secrets before sending payloads. The daemon redacts again before broadcasting and persistence.

Never log secrets. Attow Nexus logs structured context such as run ID, agent ID, channel, and commit ID.

Responsible disclosure details are in `SECURITY.md`.

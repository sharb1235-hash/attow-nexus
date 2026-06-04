# Privacy

Attow Nexus is a local-first developer tool. The local daemon, CLI, SDKs, dashboard, and SQLite ledger do not send agent state to Attow, Inc. in v0.1.

## Local Runtime

- No daemon runtime telemetry is collected by Attow Nexus in v0.1.
- No SDK runtime telemetry is collected.
- No CLI telemetry is collected.
- No local dashboard telemetry is collected.
- Local agent state, prompts, tool outputs, daemon commits, artifacts, and SQLite ledger data remain on the user's machine unless the user chooses to share them.
- Setup scripts do not install hidden telemetry.
- The GitHub repository itself does not run remote telemetry scripts.

## Install Choices

The recommended install path is to clone the repository and run the documented local setup commands. Review setup scripts before running remote shell commands, especially before piping a remote script into a shell.

## No Secrets In The Repository

API keys, private tokens, passwords, OAuth credentials, database URLs with passwords, private keys, and service secrets must not be committed to this repository. Use environment variables or local configuration files that are ignored by Git.

## Remote Use

Attow Nexus is designed to bind locally by default. If you change Docker, daemon, or network settings to expose the API outside localhost, review authentication, token handling, network access, and the sensitivity of captured logical state before doing so.

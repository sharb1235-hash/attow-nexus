# Privacy

Attow Nexus is a local-first developer tool. The local daemon, CLI, SDKs, dashboard, and SQLite ledger do not send agent state to Attow, Inc. in v0.1.

## Local Runtime

- No daemon runtime telemetry is collected by Attow Nexus in v0.1.
- No SDK runtime telemetry is collected.
- No CLI telemetry is collected.
- Local agent state, prompts, tool outputs, daemon commits, and SQLite ledger data remain on the user's machine unless the user chooses to share them.
- The GitHub repository itself does not execute tracking scripts.

## Public Web And Community Analytics

Attow, Inc. may use analytics on public launch surfaces that are separate from the local runtime:

- A public docs or landing site may use privacy-conscious analytics or visitor-identification tools such as Koala or RB2B.
- Install links may use Scarf Gateway to measure open-source installation interest.
- GitHub community activity such as stars, forks, issues, pull requests, discussions, and comments may be analyzed through Common Room.

Any public docs or landing site that uses a pixel should disclose it. Tracking scripts must not be added to the local developer dashboard by default.

## Install Choices

Users can use direct GitHub clone and setup commands if they prefer not to use Scarf-tracked install links. Scarf links, when offered, are optional and should have a direct GitHub/raw fallback.

Review setup scripts before running remote shell commands, especially before piping a remote script into a shell.

## No Secrets In The Repository

Tracking IDs, OAuth credentials, API keys, private tokens, passwords, and service secrets must not be committed to this repository. Use environment variables or service dashboards for account-specific configuration.

# MCP

The optional MCP bridge is enabled with `NEXUS_MCP_ENABLED=true`.

Tools:

- `nexus_list_runs`
- `nexus_list_agents`
- `nexus_list_channels`
- `nexus_get_commit`
- `nexus_diff_commits`
- `nexus_replay_state`
- `nexus_fork_run`
- `nexus_search_commits`
- `nexus_get_channel_snapshot`

Resources:

- `nexus://runs`
- `nexus://runs/{run_id}`
- `nexus://channels`
- `nexus://channels/{channel}`
- `nexus://commits/{commit_id}`

The bridge is local-only by default.


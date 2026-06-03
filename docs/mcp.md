# MCP

The optional MCP bridge is experimental.

Current code describes the local tool/resource surface and can be enabled with `NEXUS_MCP_ENABLED=true` where supported, but it has not yet been verified as a full MCP server runtime against a host in CI. Treat it as an early integration surface, not a production MCP deployment.

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

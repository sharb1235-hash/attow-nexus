TOOLS = [
    "nexus_list_runs",
    "nexus_list_agents",
    "nexus_list_channels",
    "nexus_get_commit",
    "nexus_diff_commits",
    "nexus_replay_state",
    "nexus_fork_run",
    "nexus_search_commits",
    "nexus_get_channel_snapshot",
]

RESOURCES = [
    "nexus://runs",
    "nexus://runs/{run_id}",
    "nexus://channels",
    "nexus://channels/{channel}",
    "nexus://commits/{commit_id}",
]


def main() -> None:
    print("Nexus MCP tools:")
    for tool in TOOLS:
        print("-", tool)
    print("Nexus MCP resources:")
    for resource in RESOURCES:
        print("-", resource)


if __name__ == "__main__":
    main()


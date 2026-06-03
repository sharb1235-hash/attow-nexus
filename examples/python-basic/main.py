from nexus_ipc import NexusClient


def main() -> None:
    client = NexusClient.connect()
    client.register_agent(
        agent_id="planner",
        run_id="demo-run",
        capabilities=["planning"],
        framework="custom",
    )
    client.register_agent(
        agent_id="researcher",
        run_id="demo-run",
        capabilities=["research"],
        framework="custom",
    )

    plan = client.checkpoint(
        agent_id="planner",
        run_id="demo-run",
        channel="topic:plan",
        state={"steps": ["find source", "summarize result"]},
        summary="Planner published a plan",
        tags=["demo", "plan"],
    )
    research = client.checkpoint(
        agent_id="researcher",
        run_id="demo-run",
        channel="topic:research",
        state={
            "claim": "Revenue increased 12 percent",
            "source": "annual_report",
            "confidence": 0.91,
        },
        summary="Researcher added revenue finding",
        tags=["demo", "research"],
        parent_commit_ids=[plan.commit_id],
    )
    print("created commits:", plan.commit_id, research.commit_id)
    print("try: nexus diff", plan.commit_id, research.commit_id)
    print("try: nexus replay", research.commit_id)


if __name__ == "__main__":
    main()

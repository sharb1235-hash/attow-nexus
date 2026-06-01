from nexus_ipc import NexusClient
from nexus_ipc.adapters.crewai import record_task_result


def main() -> None:
    client = NexusClient.connect()
    client.register_agent(agent_id="crew-researcher", run_id="crew-run", framework="crewai")
    record_task_result(
        client,
        agent_id="crew-researcher",
        run_id="crew-run",
        role="researcher",
        task_name="market_scan",
        result={"finding": "Customer expansion is the highest signal."},
    )
    print("crew task recorded")


if __name__ == "__main__":
    main()


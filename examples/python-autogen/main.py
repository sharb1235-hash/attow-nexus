from nexus_ipc import NexusClient
from nexus_ipc.adapters.autogen import record_message


def main() -> None:
    client = NexusClient.connect()
    client.register_agent(agent_id="autogen-writer", run_id="autogen-run", framework="autogen")
    record_message(
        client,
        agent_id="autogen-writer",
        run_id="autogen-run",
        channel="topic:autogen_messages",
        sender="writer",
        content="Draft intro complete.",
    )
    print("autogen message recorded")


if __name__ == "__main__":
    main()


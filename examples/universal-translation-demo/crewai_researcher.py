from __future__ import annotations

from typing import Any

from nexus_ipc import NexusClient
from nexus_ipc.adapters.crewai import instrument_crewai

RUN_ID = "universal-demo"
THREAD_ID = "main"


class FakeCrew:
    """Deterministic CrewAI-shaped surface for a no-key local demo."""

    def __init__(self) -> None:
        self.step_callback = self._step_callback

    def _step_callback(self, step: dict[str, Any]) -> None:
        print(f"crew step: {step['task']}")

    def kickoff(self, inputs: dict[str, Any] | None = None) -> dict[str, Any]:
        if callable(self.step_callback):
            self.step_callback({"task": "research-plan", "status": "done"})
        plan = (inputs or {}).get("plan", ["collect local facts"])
        return {
            "findings": [
                "Attow Nexus normalizes framework events into one local run.",
                "The demo uses deterministic local framework surfaces.",
            ],
            "plan_used": plan,
        }


def main() -> None:
    client = NexusClient.connect()
    crew = instrument_crewai(
        FakeCrew(),
        client=client,
        run_id=RUN_ID,
        agent_id="crewai-researcher",
        thread_id=THREAD_ID,
        tags=["universal-demo"],
        metadata={"demo_surface": "fake-crewai-public-shape"},
    )
    result = crew.kickoff(inputs={"plan": ["collect local facts", "summarize evidence"]})
    commit = client.checkpoint(
        agent_id="crewai-researcher",
        run_id=RUN_ID,
        thread_id=THREAD_ID,
        channel="topic:research",
        state={"research": result["findings"], "source": "crewai"},
        summary="CrewAI researcher published research",
        tags=["universal-demo", "crewai", "topic"],
    )
    print("CrewAI researcher result:")
    print(result)
    print(f"topic:research commit: {commit.commit_id}")


if __name__ == "__main__":
    main()

# Universal Translation Demo

One local daemon, one ledger, one CLI, three framework surfaces feeding the same run.

This demo uses `run_id=universal-demo` and writes canonical Attow Nexus events from:

- LangGraph Python through `instrument_langgraph`
- CrewAI-style Python through `instrument_crewai`
- Vercel AI SDK-style TypeScript through `instrumentStreamText` and `instrumentGenerateText`

No model API keys are required. The LangGraph script uses a real non-LLM `StateGraph` when `langgraph` is installed and prints a clear install command otherwise. The CrewAI and Vercel AI SDK demos use deterministic fake framework surfaces so the cross-framework Nexus flow stays local and repeatable.

## Run

Terminal 1:

```powershell
cd <repo>
docker compose up --build
```

Terminal 2:

```powershell
cd <repo>
cd sdks\python
py -m pip install -e .
py -m pip install langgraph
cd ..\..
py examples\universal-translation-demo\langgraph_planner.py
py examples\universal-translation-demo\crewai_researcher.py
```

Terminal 3:

```powershell
cd <repo>\examples\universal-translation-demo
npm.cmd install
npm.cmd run vercel-demo
```

Inspect:

```powershell
cd <repo>
cargo run -p nexus -- agents
cargo run -p nexus -- channels
cargo run -p nexus -- log --run universal-demo
curl.exe http://127.0.0.1:7823/metrics
```

Expected agents:

- `langgraph-planner`
- `crewai-researcher`
- `vercel-ai-frontend`

Expected channels include:

- `framework:langgraph:universal-demo`
- `framework:crewai:universal-demo`
- `framework:vercel-ai:universal-demo`
- `events:universal-demo:main`
- `state:universal-demo:main`
- `topic:plan`
- `topic:research`
- `topic:frontend`

The point of the demo is state translation, not LLM output quality: three different framework surfaces publish compatible canonical events into one local bus and one SQLite-backed ledger.

The application-topic commits are chained when run in order:

`topic:plan` -> `topic:research` -> `topic:frontend`

That means replaying the final frontend topic commit can include the prior planner and researcher topic state through parent commit ancestry.

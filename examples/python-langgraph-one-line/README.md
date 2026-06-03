# LangGraph One-Line Instrumentation

This example builds a real LangGraph `StateGraph`, compiles it, wraps the compiled graph with Attow Nexus, and then uses `.invoke()` and `.stream()` normally.

No node function imports `nexus_ipc`. The state schema does not change.

## Run

Start the Attow Nexus daemon first:

```powershell
docker compose up --build
```

In another PowerShell:

```powershell
cd <repo>
cd sdks\python
py -m pip install -e .
py -m pip install langgraph
cd ..\..
py examples\python-langgraph-one-line\main.py
```

Inspect the captured run:

```powershell
cargo run -p nexus -- channels
cargo run -p nexus -- log --run langgraph-demo
```

Expected channels include:

- `events:langgraph-demo:thread-1`
- `state:langgraph-demo:thread-1`

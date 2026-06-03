# Multi-Agent Demo

Planner, researcher, and writer coordinate through one local Attow Nexus daemon.

```bash
NEXUS_REQUIRE_AUTH=false nexus daemon start
./run.sh
nexus log --run multi-agent-demo
```

The scripts intentionally repeat a failing tool summary so Attow Nexus emits a loop warning after repeated durable commits.

# Python Basic

Run a local daemon first:

```bash
NEXUS_REQUIRE_AUTH=false nexus daemon start
```

Then run:

```bash
python main.py
nexus agents
nexus channels
nexus log --run demo-run
```


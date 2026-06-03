# Python Basic

Run a local daemon first:

```powershell
docker compose up --build
```

Then run from another Windows PowerShell terminal:

```powershell
py examples\python-basic\main.py
cargo run -p nexus -- agents
cargo run -p nexus -- channels
cargo run -p nexus -- log --run demo-run
cargo run -p nexus -- replay <research_commit_id>
```

The demo links the research commit to the planner commit with `parent_commit_ids`, so replaying the research commit reconstructs the captured plan state and the research state through explicit ancestry.

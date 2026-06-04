# Broken Agent Recovery Demo

This is the flagship local proof for **Git for AI agent state**.

Git gave developers version control for code. Attow Nexus gives developers version control for agent state.

The demo runs a deterministic local multi-agent workflow:

1. `planner-agent` creates a plan to add `retry_limit` to a toy config.
2. `coder-agent` produces invalid captured logical state with `retry_limit: "five"`.
3. `reviewer-agent` detects `retry_limit must be an integer`.
4. The developer diffs the last good commit against the bad commit.
5. The developer replays the last good commit.
6. `coder-agent` applies `fixed_config.json` from the recovered logical state.
7. `reviewer-agent` validates the recovered state.

No LLM calls, API keys, cloud services, real deployments, or database writes are used.

## Run

Terminal 1:

```powershell
docker compose up --build
```

Terminal 2:

```powershell
py -m pip install -e sdks\python
py examples\broken-agent-recovery\run_demo.py
```

Then inspect with the commit IDs printed by the script:

```powershell
cargo run -p nexus -- log --run broken-agent-demo
cargo run -p nexus -- diff <last_good_commit> <bad_commit>
cargo run -p nexus -- replay <last_good_commit>
cargo run -p nexus -- replay <final_commit>
```

## Commit Shape

The bad path is preserved:

`planner commit -> invalid coder commit -> reviewer failure commit`

The recovery path branches from the last good planner commit:

`planner commit -> recovery commit -> reviewer pass commit`

History is not deleted. Replay reconstructs captured logical agent state along explicit parent links.

The durable commits are written to:

- `demo:broken-agent:plan`
- `demo:broken-agent:coder`
- `demo:broken-agent:review`
- `demo:broken-agent:recovery`

The demo also publishes ephemeral live context to:

- `state:broken-agent-demo:main`
- `events:broken-agent-demo:main`

## Side-Effect Caveat

The config write is simulated as captured logical state. Attow Nexus does not automatically undo real-world side effects such as file writes, emails, API calls, purchases, deployments, or database mutations unless an adapter provides compensating actions.

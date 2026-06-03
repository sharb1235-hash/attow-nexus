# HTTP API

The HTTP API is local-first JSON over loopback by default. When auth is enabled, pass:

```powershell
$env:NEXUS_AUTH_TOKEN="your-token"
curl.exe -H "Authorization: Bearer $env:NEXUS_AUTH_TOKEN" http://127.0.0.1:7822/api/health
```

Error responses are plain text in the current MVP. Contract validation errors try to name the field and expected shape.

## Health

```powershell
curl.exe http://127.0.0.1:7822/api/health
```

Returns daemon status, daemon version, protocol version, auth status, bind mode, and local-only status.

## Metrics Summary

```powershell
curl.exe http://127.0.0.1:7822/api/metrics-summary
```

Returns JSON counters for agents, channels, deltas, commits, loop warnings, backpressure, artifacts, errors, and memory.

Prometheus metrics are served separately:

```powershell
curl.exe http://127.0.0.1:7823/metrics
```

## Universal Events

```powershell
curl.exe -X POST http://127.0.0.1:7822/api/events `
  -H "Content-Type: application/json" `
  --data-binary "@test-fixtures/universal-events/langgraph-run-start.json"
```

`POST /api/events` accepts canonical snake_case `UniversalAgentEvent` JSON and stores it as a durable checkpoint. The event payload itself becomes the captured logical state for replay/diff.

Useful validation errors include:

- `UniversalAgentEvent.run_id is required`
- `channel must match allowed Nexus channel pattern`
- `parent_commit_ids must be an array of commit ID strings`
- `timestamp_ms must be an integer Unix timestamp in milliseconds`

## Checkpoint

```powershell
curl.exe -X POST http://127.0.0.1:7822/api/checkpoint `
  -H "Content-Type: application/json" `
  -d "{\"agent_id\":\"worker\",\"run_id\":\"demo\",\"thread_id\":\"main\",\"channel\":\"topic:demo\",\"state\":{\"ok\":true}}"
```

Creates a durable commit from arbitrary JSON state.

## Runs And Commits

```powershell
curl.exe http://127.0.0.1:7822/api/runs
curl.exe http://127.0.0.1:7822/api/runs/contract-fixture-demo/commits
curl.exe http://127.0.0.1:7822/api/commits/<commit_id>
```

## Diff

```powershell
curl.exe "http://127.0.0.1:7822/api/diff?from=<commit_a>&to=<commit_b>"
```

Returns a machine-readable diff and human summary.

## Replay

```powershell
curl.exe -X POST http://127.0.0.1:7822/api/replay `
  -H "Content-Type: application/json" `
  -d "{\"commit_id\":\"<commit_id>\",\"mode\":\"state_only\"}"
```

Replay reconstructs captured logical state by following commit ancestry. It does not reverse or deterministically replay external side effects.

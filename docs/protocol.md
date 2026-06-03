# Protocol

The protocol package is `nexus.v1`.

Schemas live in `proto/nexus/v1`:

- `common.proto`
- `ipc.proto`
- `ledger.proto`
- `service.proto`
- `mcp.proto`

The protocol is versioned and backward-compatible. Field numbers are never reused. Deleted fields and enum values must be reserved. Buf lint and breaking checks run in CI.

Payloads support protobuf struct, JSON, MessagePack, CBOR, text, and bytes encodings. Large payloads should be stored as artifacts and referenced by artifact ID.

## Canonical Universal Agent Event

Attow Nexus normalizes framework-specific runtime events into a canonical local event shape. Python and TypeScript adapters may expose idiomatic APIs, but both serialize into the same daemon-compatible event contract.

The canonical external JSON representation is snake_case. TypeScript helpers may accept camelCase at the public API boundary, but serialized daemon payloads use snake_case.

Required fields:

- `schema_version`: currently `nexus.universal.v1`
- `event_id`
- `run_id`
- `thread_id`
- `agent_id`
- `framework`
- `language`
- `event_type`
- `channel`
- `metadata`
- `tags`
- `parent_commit_ids`
- `timestamp_ms`

Optional fields:

- `sdk_name`
- `sdk_version`
- `adapter_name`
- `adapter_version`
- `framework_version`
- `step_name`
- `node_name`
- `task_name`
- `tool_name`
- `input`
- `output`
- `delta`
- `messages`
- `error`

Valid `event_type` values are `run_start`, `run_end`, `step_start`, `step_end`, `node_start`, `node_end`, `task_start`, `task_end`, `tool_start`, `tool_end`, `stream_delta`, `message_delta`, `state_checkpoint`, `error`, and `custom`.

Valid framework values for the developer-preview adapters are `langgraph`, `crewai`, `vercel-ai`, `generic`, `custom`, `autogen`, and `microsoft-agent-framework`.

Canonical channels:

- `framework:{framework}:{run_id}`
- `events:{run_id}:{thread_id}`
- `state:{run_id}:{thread_id}`
- `tool:{run_id}:{tool_name}`
- `topic:{topic_name}`

`timestamp_ms` is an integer Unix timestamp in milliseconds. Fixtures and golden files use fixed timestamps for deterministic parity tests.

`parent_commit_ids` must be an array of commit ID strings. SDK adapters maintain the latest commit per run/thread/framework and use parent IDs to form replayable ancestry chains.

Payload size behavior is daemon-configured. SDKs produce deterministic JSON payloads; the daemon may inline, compress, or store large payloads as artifacts according to local limits.

Redaction runs before SDK serialization and again in the daemon before persistence. The canonical redaction fixture asserts that `api_key`, `Authorization: Bearer ...`, and `password` values are replaced with `[REDACTED]`.

Malformed events are rejected with developer-facing errors such as `UniversalAgentEvent.run_id is required`, `channel must match allowed Nexus channel pattern`, `parent_commit_ids must be an array of commit ID strings`, and `timestamp_ms must be an integer Unix timestamp in milliseconds`.

Schema evolution policy: `nexus.universal.v1` is append-only for public developer preview. New optional fields may be added. Existing field names and meanings should not change without a new schema version and fixtures.

Canonical fixtures live in `test-fixtures/universal-events`, with cross-language golden outputs in `test-fixtures/golden`.

Manual release breaking check:

```powershell
npx.cmd @bufbuild/buf breaking --against ".git#branch=main"
```

CI runs Buf lint and performs a non-blocking breaking check when the main branch comparison is available.

# Contributing

## Local Development

```bash
cargo build --workspace
cargo test --workspace
NEXUS_REQUIRE_AUTH=false cargo run -p nexus -- daemon start
```

Dashboard:

```bash
cd dashboard
npm install
npm run build
```

Python SDK:

```bash
cd sdks/python
pip install -e ".[dev]"
ruff check .
pytest
```

TypeScript SDK:

```bash
cd sdks/typescript
npm install
npm run lint
npm run test
npm run build
```

## Protobuf Workflow

Schemas live in `proto/nexus/v1`. Field numbers are append-only. Deleted fields and enum values must be reserved. Run:

```bash
buf lint
buf breaking --against '.git#branch=main'
```

## Pull Requests

Keep changes scoped, add tests for behavior changes, update docs for user-visible changes, and avoid private framework interception. Adapters should use public hooks, callbacks, middleware, checkpointers, or explicit wrappers.


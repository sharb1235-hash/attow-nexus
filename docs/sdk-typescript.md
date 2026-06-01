# TypeScript SDK

Package name: `@nexus-ipc/sdk`.

The SDK supports register, publish, subscribe, checkpoint, replay, diff, fork, rollback, `checkpointStep`, `wrapTool`, `createRun`, and `recordSideEffect`.

Validation uses zod. Payload redaction runs before network requests. Subscription uses an async iterator with polling.


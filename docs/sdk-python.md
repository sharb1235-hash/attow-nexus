# Python SDK

Package name: `nexus-ipc`.

The sync client supports agent registration, delta publishing, subscription polling, checkpointing, replay, diff, fork, rollback, and external side-effect recording.

The async client mirrors the sync API by running blocking HTTP calls in worker threads and exposing an async iterator for subscriptions.

Models use Pydantic and validate IDs, channel names, and payload structure. Redaction runs before network requests.


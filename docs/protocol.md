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


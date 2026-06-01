# Loop Detection

Loop detection is heuristic in the MVP.

Fingerprints use objective, recent message summaries, recent tool names, tool error types, selected state keys, payload hashes, repeated deltas, and parent patterns.

Nexus detects repeated fingerprints, repeated tool-call failures, and oscillation patterns within a sliding window. It emits low, medium, or high severity warnings and does not kill agents automatically.


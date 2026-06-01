import { describe, expect, it } from "vitest";

import { REDACTED, redact } from "../src/redaction";

describe("redaction", () => {
  it("redacts secret keys", () => {
    const result = redact({ api_key: "sk-abc12345678901234567890", safe: "ok" });
    expect(result.value.api_key).toBe(REDACTED);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("redacts bearer tokens", () => {
    const result = redact({ header: "Bearer abc.def.ghi" });
    expect(result.value.header).toBe(REDACTED);
  });
});


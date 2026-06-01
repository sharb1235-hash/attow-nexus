export const REDACTED = "[REDACTED]";

const secretKeys = [
  "password",
  "token",
  "api_key",
  "apikey",
  "secret",
  "private_key",
  "access_token",
  "refresh_token",
];

const patterns: Array<[string, RegExp]> = [
  ["bearer_token", /Bearer\s+[A-Za-z0-9._\-]+/gi],
  ["pem_block", /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g],
  ["aws_access_key", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["github_token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g],
  ["openai_token", /\bsk-[A-Za-z0-9_\-]{20,}\b/g],
  ["anthropic_token", /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g],
  ["jwt", /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g],
  ["database_url_password", /\b[a-z][a-z0-9+.-]*:\/\/[^:\s/]+:[^@\s]+@/gi],
];

export interface RedactionFinding {
  fieldPath: string;
  redactionType: string;
  replacementMarker: string;
}

export function redact<T>(value: T): { value: T; findings: RedactionFinding[] } {
  const findings: RedactionFinding[] = [];
  const cloned = clone(value);
  return { value: redactValue(cloned, "$", findings) as T, findings };
}

function redactValue(value: unknown, path: string, findings: RedactionFinding[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(item, `${path}[${index}]`, findings));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      const childPath = `${path}.${key}`;
      if (secretKeys.some((secret) => key.toLowerCase().includes(secret))) {
        record[key] = REDACTED;
        findings.push(finding(childPath, "secret_key"));
      } else {
        record[key] = redactValue(child, childPath, findings);
      }
    }
    return record;
  }
  if (typeof value === "string") {
    let output = value;
    for (const [name, pattern] of patterns) {
      const updated = output.replace(pattern, REDACTED);
      if (updated !== output) {
        findings.push(finding(path, name));
        output = updated;
      }
    }
    return output;
  }
  return value;
}

function finding(fieldPath: string, redactionType: string): RedactionFinding {
  return { fieldPath, redactionType, replacementMarker: REDACTED };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}


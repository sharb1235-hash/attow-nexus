from __future__ import annotations

import copy
import re
from typing import Any

REDACTED = "[REDACTED]"

SECRET_KEYS = {
    "password",
    "token",
    "api_key",
    "apikey",
    "secret",
    "private_key",
    "access_token",
    "refresh_token",
}

PATTERNS = [
    ("bearer_token", re.compile(r"(?i)Bearer\s+[A-Za-z0-9._\-]+")),
    ("pem_block", re.compile(r"-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----")),
    ("aws_access_key", re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("openai_token", re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b")),
    ("anthropic_token", re.compile(r"\bsk-ant-[A-Za-z0-9_\-]{20,}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b")),
    ("database_url_password", re.compile(r"(?i)\b[a-z][a-z0-9+.-]*://[^:\s/]+:[^@\s]+@")),
]


def redact(value: Any) -> tuple[Any, list[dict[str, str]]]:
    findings: list[dict[str, str]] = []
    redacted = _redact(copy.deepcopy(value), "$", findings)
    return redacted, findings


def _redact(value: Any, path: str, findings: list[dict[str, str]]) -> Any:
    if isinstance(value, dict):
        for key, child in list(value.items()):
            child_path = f"{path}.{key}"
            if _secret_key(key):
                value[key] = REDACTED
                findings.append(_finding(child_path, "secret_key"))
            else:
                value[key] = _redact(child, child_path, findings)
        return value
    if isinstance(value, list):
        return [_redact(child, f"{path}[{idx}]", findings) for idx, child in enumerate(value)]
    if isinstance(value, str):
        output = value
        for name, pattern in PATTERNS:
            updated = pattern.sub(REDACTED, output)
            if updated != output:
                findings.append(_finding(path, name))
                output = updated
        return output
    return value


def _secret_key(key: str) -> bool:
    lowered = key.lower()
    return any(secret in lowered for secret in SECRET_KEYS)


def _finding(path: str, redaction_type: str) -> dict[str, str]:
    return {
        "field_path": path,
        "redaction_type": redaction_type,
        "replacement_marker": REDACTED,
    }


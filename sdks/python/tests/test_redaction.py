from nexus_ipc.redaction import REDACTED, redact


def test_redacts_secret_keys() -> None:
    value, findings = redact({"api_key": "sk-abc12345678901234567890", "safe": "ok"})
    assert value["api_key"] == REDACTED
    assert findings


def test_redacts_tokens_in_text() -> None:
    value, findings = redact({"header": "Bearer abc.def.ghi"})
    assert value["header"] == REDACTED
    assert findings[0]["redaction_type"] == "bearer_token"


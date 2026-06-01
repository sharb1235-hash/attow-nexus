use std::sync::OnceLock;

use prost_types::value::Kind;
use prost_types::{ListValue, Struct, Value};
use regex::Regex;
use serde_json::{Map, Value as JsonValue};

use crate::generated::nexus::v1::{Payload, PayloadEncoding, RedactionFinding, RedactionReport};
use crate::util::hash::blake3_hex;

const MARKER: &str = "[REDACTED]";

#[derive(Debug, Default, Clone)]
pub struct Redactor;

impl Redactor {
    pub fn redact_payload(&self, payload: &mut Payload) -> RedactionReport {
        let mut findings = Vec::new();

        if let Some(struct_data) = payload.struct_data.as_mut() {
            redact_struct(struct_data, "$", &mut findings);
        }

        match PayloadEncoding::try_from(payload.encoding).unwrap_or(PayloadEncoding::Unspecified) {
            PayloadEncoding::Json => {
                if let Ok(mut json) = serde_json::from_slice::<JsonValue>(&payload.data) {
                    redact_json(&mut json, "$", &mut findings);
                    if let Ok(bytes) = serde_json::to_vec(&json) {
                        payload.size_bytes = bytes.len() as u64;
                        payload.content_hash = blake3_hex(&bytes);
                        payload.data = bytes;
                    }
                }
            }
            PayloadEncoding::Text => {
                if let Ok(text) = std::str::from_utf8(&payload.data) {
                    let redacted = redact_text(text, "$", &mut findings);
                    payload.data = redacted.into_bytes();
                    payload.size_bytes = payload.data.len() as u64;
                    payload.content_hash = blake3_hex(&payload.data);
                }
            }
            PayloadEncoding::Bytes
            | PayloadEncoding::Msgpack
            | PayloadEncoding::Cbor
            | PayloadEncoding::ProtobufStruct
            | PayloadEncoding::Unspecified => {}
        }

        RedactionReport {
            redacted: !findings.is_empty(),
            findings,
        }
    }
}

fn redact_json(value: &mut JsonValue, path: &str, findings: &mut Vec<RedactionFinding>) {
    match value {
        JsonValue::Object(map) => redact_json_object(map, path, findings),
        JsonValue::Array(items) => {
            for (idx, item) in items.iter_mut().enumerate() {
                redact_json(item, &format!("{path}[{idx}]"), findings);
            }
        }
        JsonValue::String(text) => {
            let replacement = redact_text(text, path, findings);
            if replacement != *text {
                *text = replacement;
            }
        }
        JsonValue::Null | JsonValue::Bool(_) | JsonValue::Number(_) => {}
    }
}

fn redact_json_object(
    map: &mut Map<String, JsonValue>,
    path: &str,
    findings: &mut Vec<RedactionFinding>,
) {
    for (key, value) in map.iter_mut() {
        let child_path = format!("{path}.{key}");
        if secret_key_name(key) {
            *value = JsonValue::String(MARKER.to_string());
            findings.push(finding(&child_path, "secret_key"));
        } else {
            redact_json(value, &child_path, findings);
        }
    }
}

fn redact_struct(value: &mut Struct, path: &str, findings: &mut Vec<RedactionFinding>) {
    for (key, value) in value.fields.iter_mut() {
        let child_path = format!("{path}.{key}");
        if secret_key_name(key) {
            value.kind = Some(Kind::StringValue(MARKER.to_string()));
            findings.push(finding(&child_path, "secret_key"));
        } else {
            redact_prost_value(value, &child_path, findings);
        }
    }
}

fn redact_prost_value(value: &mut Value, path: &str, findings: &mut Vec<RedactionFinding>) {
    match value.kind.as_mut() {
        Some(Kind::StringValue(text)) => {
            let replacement = redact_text(text, path, findings);
            if replacement != *text {
                *text = replacement;
            }
        }
        Some(Kind::StructValue(inner)) => redact_struct(inner, path, findings),
        Some(Kind::ListValue(ListValue { values })) => {
            for (idx, item) in values.iter_mut().enumerate() {
                redact_prost_value(item, &format!("{path}[{idx}]"), findings);
            }
        }
        Some(Kind::NullValue(_)) | Some(Kind::NumberValue(_)) | Some(Kind::BoolValue(_)) | None => {
        }
    }
}

fn redact_text(text: &str, path: &str, findings: &mut Vec<RedactionFinding>) -> String {
    let mut output = text.to_string();
    for (name, regex) in patterns() {
        let replaced = regex.replace_all(&output, MARKER).to_string();
        if replaced != output {
            findings.push(finding(path, name));
            output = replaced;
        }
    }
    output
}

fn secret_key_name(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    [
        "password",
        "token",
        "api_key",
        "apikey",
        "secret",
        "private_key",
        "access_token",
        "refresh_token",
    ]
    .iter()
    .any(|needle| key.contains(needle))
}

fn patterns() -> &'static [(&'static str, Regex)] {
    static PATTERNS: OnceLock<Vec<(&'static str, Regex)>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        vec![
            (
                "bearer_token",
                Regex::new(r"(?i)Bearer\s+[A-Za-z0-9._\-]+").unwrap(),
            ),
            (
                "pem_block",
                Regex::new(r"-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----").unwrap(),
            ),
            (
                "aws_access_key",
                Regex::new(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b").unwrap(),
            ),
            (
                "github_token",
                Regex::new(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b").unwrap(),
            ),
            (
                "openai_token",
                Regex::new(r"\bsk-[A-Za-z0-9_\-]{20,}\b").unwrap(),
            ),
            (
                "anthropic_token",
                Regex::new(r"\bsk-ant-[A-Za-z0-9_\-]{20,}\b").unwrap(),
            ),
            (
                "jwt",
                Regex::new(r"\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b").unwrap(),
            ),
            (
                "database_url_password",
                Regex::new(r"(?i)\b[a-z][a-z0-9+.-]*://[^:\s/]+:[^@\s]+@").unwrap(),
            ),
        ]
    })
}

fn finding(path: &str, redaction_type: &str) -> RedactionFinding {
    RedactionFinding {
        field_path: path.to_string(),
        redaction_type: redaction_type.to_string(),
        replacement_marker: MARKER.to_string(),
    }
}

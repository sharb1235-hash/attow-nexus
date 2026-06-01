use serde_json::{json, Map, Value};

use crate::generated::nexus::v1::{Commit, CommitDiff, DiffEntry, Payload, PayloadEncoding};

pub fn diff_commits(from: &Commit, to: &Commit) -> CommitDiff {
    let before = payload_to_json(from.state_delta.as_ref());
    let after = payload_to_json(to.state_delta.as_ref());
    let mut entries = Vec::new();
    diff_value("$", &before, &after, &mut entries);

    if from.summary != to.summary {
        entries.push(entry("summary", "changed", &from.summary, &to.summary));
    }
    if from.tags != to.tags {
        entries.push(entry("tags", "changed", &from.tags, &to.tags));
    }
    if from.tool_calls.len() != to.tool_calls.len() {
        entries.push(entry(
            "tool_calls",
            "changed",
            &from.tool_calls.len(),
            &to.tool_calls.len(),
        ));
    }
    if from.tool_results.len() != to.tool_results.len() {
        entries.push(entry(
            "tool_results",
            "changed",
            &from.tool_results.len(),
            &to.tool_results.len(),
        ));
    }
    if from.artifact_refs.len() != to.artifact_refs.len() {
        entries.push(entry(
            "artifacts",
            "changed",
            &from.artifact_refs.len(),
            &to.artifact_refs.len(),
        ));
    }
    if from.external_side_effects.len() != to.external_side_effects.len() {
        entries.push(entry(
            "external_side_effects",
            "changed",
            &from.external_side_effects.len(),
            &to.external_side_effects.len(),
        ));
    }

    let human_summary = if entries.is_empty() {
        "No captured logical state changes.".to_string()
    } else {
        format!("{} captured logical state change(s).", entries.len())
    };

    CommitDiff {
        from_commit_id: from.commit_id.clone(),
        to_commit_id: to.commit_id.clone(),
        entries,
        human_summary,
    }
}

pub fn payload_to_json(payload: Option<&Payload>) -> Value {
    let Some(payload) = payload else {
        return Value::Null;
    };
    match PayloadEncoding::try_from(payload.encoding).unwrap_or(PayloadEncoding::Unspecified) {
        PayloadEncoding::Json => serde_json::from_slice(&payload.data).unwrap_or_else(|_| {
            json!({
                "content_hash": payload.content_hash,
                "size_bytes": payload.size_bytes
            })
        }),
        PayloadEncoding::Text => Value::String(String::from_utf8_lossy(&payload.data).to_string()),
        _ => json!({
            "content_hash": payload.content_hash,
            "size_bytes": payload.size_bytes,
            "artifact_ref": payload.artifact_ref
        }),
    }
}

fn diff_value(path: &str, before: &Value, after: &Value, entries: &mut Vec<DiffEntry>) {
    match (before, after) {
        (Value::Object(left), Value::Object(right)) => diff_object(path, left, right, entries),
        _ if before == after => {}
        _ => entries.push(entry(path, "changed", before, after)),
    }
}

fn diff_object(
    path: &str,
    before: &Map<String, Value>,
    after: &Map<String, Value>,
    entries: &mut Vec<DiffEntry>,
) {
    for key in before.keys() {
        let child = format!("{path}.{key}");
        if !after.contains_key(key) {
            entries.push(entry(
                &child,
                "removed",
                before.get(key).unwrap(),
                &Value::Null,
            ));
        }
    }
    for (key, after_value) in after {
        let child = format!("{path}.{key}");
        match before.get(key) {
            Some(before_value) => diff_value(&child, before_value, after_value, entries),
            None => entries.push(entry(&child, "added", &Value::Null, after_value)),
        }
    }
}

fn entry<T: serde::Serialize, U: serde::Serialize>(
    path: &str,
    change_type: &str,
    before: &T,
    after: &U,
) -> DiffEntry {
    DiffEntry {
        path: path.to_string(),
        change_type: change_type.to_string(),
        before_json: serde_json::to_string(before).unwrap_or_else(|_| "null".to_string()),
        after_json: serde_json::to_string(after).unwrap_or_else(|_| "null".to_string()),
    }
}

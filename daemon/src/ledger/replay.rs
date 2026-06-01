use anyhow::bail;
use serde_json::{Map, Value};

use crate::generated::nexus::v1::{
    Payload, PayloadEncoding, ReplayMode, ReplayRequest, ReplayResult,
};
use crate::ledger::diff::payload_to_json;
use crate::ledger::store::Store;
use crate::util::hash::blake3_hex;

pub fn replay(store: &dyn Store, request: &ReplayRequest) -> anyhow::Result<ReplayResult> {
    let mode = ReplayMode::try_from(request.mode).unwrap_or(ReplayMode::StateOnly);
    if mode == ReplayMode::ReexecuteTools && !request.confirm_reexecute_tools {
        bail!("reexecute_tools requires explicit confirmation");
    }

    let mut commits = ancestry_commits(store, &request.commit_id)?;
    commits.sort_by_key(|commit| {
        (
            commit.logical_clock,
            commit
                .wall_time
                .as_ref()
                .map(|timestamp| timestamp.seconds)
                .unwrap_or_default(),
        )
    });

    let mut state = Value::Object(Map::new());
    let mut side_effect_warnings = Vec::new();
    let mut provenance = Vec::new();
    let mut tool_outputs = Vec::new();
    let mut artifacts = Vec::new();

    for commit in commits {
        provenance.push(commit.commit_id.clone());
        merge_value(&mut state, payload_to_json(commit.state_delta.as_ref()));
        tool_outputs.extend(commit.tool_results);
        artifacts.extend(commit.artifact_refs);
        for side_effect in commit.external_side_effects {
            side_effect_warnings.push(format!(
                "External side effect '{}' of kind '{}' is irreversible unless an adapter supplies a compensating action.",
                side_effect.side_effect_id, side_effect.kind
            ));
        }
    }

    let bytes = serde_json::to_vec(&state)?;
    Ok(ReplayResult {
        commit_id: request.commit_id.clone(),
        reconstructed_state: Some(Payload {
            encoding: PayloadEncoding::Json as i32,
            data: bytes.clone(),
            struct_data: None,
            size_bytes: bytes.len() as u64,
            content_hash: blake3_hex(&bytes),
            compressed: false,
            artifact_ref: String::new(),
        }),
        messages: Vec::new(),
        tool_outputs,
        artifacts,
        side_effect_warnings,
        provenance_commit_ids: provenance,
        missing_artifact_warnings: Vec::new(),
    })
}

fn ancestry_commits(
    store: &dyn Store,
    commit_id: &str,
) -> anyhow::Result<Vec<crate::generated::nexus::v1::Commit>> {
    let mut out = Vec::new();
    collect(store, commit_id, &mut out)?;
    Ok(out)
}

fn collect(
    store: &dyn Store,
    commit_id: &str,
    out: &mut Vec<crate::generated::nexus::v1::Commit>,
) -> anyhow::Result<()> {
    let Some(commit) = store.get_commit(commit_id)? else {
        bail!("commit {commit_id} not found");
    };
    for parent in &commit.parent_commit_ids {
        collect(store, parent, out)?;
    }
    if !out
        .iter()
        .any(|existing| existing.commit_id == commit.commit_id)
    {
        out.push(commit);
    }
    Ok(())
}

fn merge_value(target: &mut Value, patch: Value) {
    match (target, patch) {
        (Value::Object(target_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                merge_value(target_map.entry(key).or_insert(Value::Null), value);
            }
        }
        (target_slot, value) => {
            *target_slot = value;
        }
    }
}

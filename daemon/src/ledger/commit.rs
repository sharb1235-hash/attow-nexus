use prost::Message;

use crate::generated::nexus::v1::{
    ArtifactRef, Commit, ExternalSideEffect, Payload, RedactionReport, StateDelta, ToolCall,
    ToolResult,
};
use crate::util::hash::blake3_hex;

#[derive(Debug, Clone, Default)]
pub struct CommitExtras {
    pub objective: String,
    pub tool_calls: Vec<ToolCall>,
    pub tool_results: Vec<ToolResult>,
    pub artifact_refs: Vec<ArtifactRef>,
    pub external_side_effects: Vec<ExternalSideEffect>,
    pub sdk_name: String,
    pub sdk_version: String,
}

pub fn from_delta(
    delta: &StateDelta,
    parent_commit_ids: Vec<String>,
    payload: Payload,
    redaction_report: RedactionReport,
    extras: CommitExtras,
) -> Commit {
    let mut commit = Commit {
        commit_id: String::new(),
        delta_id: delta.delta_id.clone(),
        run_id: delta.run_id.clone(),
        thread_id: delta.thread_id.clone(),
        agent_id: delta.agent_id.clone(),
        channel: delta.channel.clone(),
        parent_commit_ids,
        logical_clock: delta.logical_clock,
        wall_time: delta.wall_time,
        objective: extras.objective,
        state_delta: Some(payload),
        messages_delta: None,
        tool_calls: extras.tool_calls,
        tool_results: extras.tool_results,
        artifact_refs: extras.artifact_refs,
        external_side_effects: extras.external_side_effects,
        summary: delta.summary.clone(),
        tags: delta.tags.clone(),
        metadata: delta.metadata.clone(),
        schema_version: 1,
        sdk_name: extras.sdk_name,
        sdk_version: extras.sdk_version,
        content_hash: String::new(),
        previous_hashes: Vec::new(),
        redaction_report: Some(redaction_report),
    };

    let content_bytes = commit.encode_to_vec();
    commit.content_hash = blake3_hex(&content_bytes);
    let id_bytes = commit.encode_to_vec();
    let full_hash = blake3_hex(&id_bytes);
    commit.commit_id = format!("c_{}", &full_hash[..32]);
    commit
}

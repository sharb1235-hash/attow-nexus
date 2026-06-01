use crate::generated::nexus::v1::Commit;
use crate::util::hash::blake3_hex;

pub fn fingerprint(commit: &Commit) -> String {
    let tool_names = commit
        .tool_calls
        .iter()
        .map(|tool| tool.name.as_str())
        .collect::<Vec<_>>()
        .join(",");
    let error_types = commit
        .tool_results
        .iter()
        .filter_map(|result| result.error.as_ref().map(|error| error.code.as_str()))
        .collect::<Vec<_>>()
        .join(",");
    let payload_hash = commit
        .state_delta
        .as_ref()
        .map(|payload| payload.content_hash.as_str())
        .unwrap_or_default();
    blake3_hex(
        format!(
            "{}|{}|{}|{}|{}|{:?}",
            commit.objective,
            commit.summary,
            payload_hash,
            tool_names,
            error_types,
            commit.parent_commit_ids
        )
        .as_bytes(),
    )
}

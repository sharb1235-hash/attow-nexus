use anyhow::bail;

use crate::generated::nexus::v1::{RollbackRequest, RollbackResponse};
use crate::ledger::dag::DagIndex;
use crate::ledger::store::Store;

pub fn rollback(
    store: &dyn Store,
    dag: &DagIndex,
    request: &RollbackRequest,
) -> anyhow::Result<RollbackResponse> {
    if !request.force && !dag.is_ancestor(&request.target_commit_id, &request.head_commit_id) {
        bail!("target commit is not an ancestor of the current head; use force to move the head anyway");
    }

    let Some(head) = store.get_commit(&request.head_commit_id)? else {
        bail!("head commit not found");
    };
    let Some(target) = store.get_commit(&request.target_commit_id)? else {
        bail!("target commit not found");
    };

    let mut warnings = Vec::new();
    for commit_id in dag.ancestry(&request.head_commit_id) {
        if commit_id == request.target_commit_id {
            break;
        }
        if let Some(commit) = store.get_commit(&commit_id)? {
            for side_effect in commit.external_side_effects {
                warnings.push(format!(
                    "Commit {} includes external side effect '{}' of kind '{}'. Rollback moves captured logical state only.",
                    commit.commit_id, side_effect.side_effect_id, side_effect.kind
                ));
            }
        }
    }

    store.set_head(
        &head.run_id,
        &head.thread_id,
        &head.agent_id,
        &head.channel,
        &target.commit_id,
    )?;
    store.append_event(
        "rollback",
        &serde_json::json!({
            "previous_head_commit_id": head.commit_id,
            "new_head_commit_id": target.commit_id,
            "warnings": warnings
        })
        .to_string(),
    )?;

    Ok(RollbackResponse {
        moved: true,
        previous_head_commit_id: request.head_commit_id.clone(),
        new_head_commit_id: request.target_commit_id.clone(),
        warnings,
    })
}

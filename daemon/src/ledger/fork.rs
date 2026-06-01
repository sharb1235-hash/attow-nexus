use crate::generated::nexus::v1::{ForkRequest, ForkResult};
use crate::ledger::store::Store;
use crate::util::ids::new_id;

pub fn fork(store: &dyn Store, request: &ForkRequest) -> anyhow::Result<ForkResult> {
    let Some(source) = store.get_commit(&request.source_commit_id)? else {
        anyhow::bail!("source commit not found");
    };
    let run_id = if request.new_run_id.is_empty() {
        new_id("run")
    } else {
        request.new_run_id.clone()
    };
    store.set_head(
        &run_id,
        &source.thread_id,
        &source.agent_id,
        &source.channel,
        &source.commit_id,
    )?;
    store.append_event(
        "fork",
        &serde_json::json!({
            "source_commit_id": source.commit_id,
            "run_id": run_id
        })
        .to_string(),
    )?;
    Ok(ForkResult {
        source_commit_id: request.source_commit_id.clone(),
        run_id,
        head_commit_id: request.source_commit_id.clone(),
    })
}

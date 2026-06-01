#[derive(Debug, Clone)]
pub struct LedgerSnapshot {
    pub run_id: String,
    pub head_commit_ids: Vec<String>,
}

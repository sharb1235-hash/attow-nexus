#[derive(Debug, Clone)]
pub struct CompactionPlan {
    pub keep_recent_commits: usize,
    pub preserve_all_history: bool,
}

impl Default for CompactionPlan {
    fn default() -> Self {
        Self {
            keep_recent_commits: 10_000,
            preserve_all_history: true,
        }
    }
}

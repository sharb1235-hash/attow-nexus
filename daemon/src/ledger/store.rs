use crate::generated::nexus::v1::{ArtifactRef, Commit, LoopWarning, RunSummary};

pub trait Store: Send + Sync {
    fn append_commit(&self, commit: &Commit) -> anyhow::Result<()>;
    fn get_commit(&self, commit_id: &str) -> anyhow::Result<Option<Commit>>;
    fn list_all_commits(&self) -> anyhow::Result<Vec<Commit>>;
    fn list_commits(
        &self,
        run_id: Option<&str>,
        thread_id: Option<&str>,
        channel: Option<&str>,
    ) -> anyhow::Result<Vec<Commit>>;
    fn list_runs(&self) -> anyhow::Result<Vec<RunSummary>>;
    fn get_head(
        &self,
        run_id: &str,
        thread_id: &str,
        agent_id: &str,
        channel: &str,
    ) -> anyhow::Result<Option<String>>;
    fn set_head(
        &self,
        run_id: &str,
        thread_id: &str,
        agent_id: &str,
        channel: &str,
        commit_id: &str,
    ) -> anyhow::Result<()>;
    fn append_event(&self, event_type: &str, payload_json: &str) -> anyhow::Result<()>;
    fn put_artifact(&self, bytes: &[u8], media_type: &str) -> anyhow::Result<ArtifactRef>;
    fn get_artifact(&self, artifact_id: &str) -> anyhow::Result<Option<Vec<u8>>>;
    fn search_by_tag(&self, tag: &str) -> anyhow::Result<Vec<Commit>>;
    fn append_loop_warning(&self, warning: &LoopWarning) -> anyhow::Result<()>;
    fn list_loop_warnings(&self) -> anyhow::Result<Vec<LoopWarning>>;
}

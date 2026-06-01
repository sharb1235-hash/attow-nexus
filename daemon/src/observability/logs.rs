use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct StructuredLogContext {
    pub run_id: Option<String>,
    pub agent_id: Option<String>,
    pub channel: Option<String>,
    pub commit_id: Option<String>,
}

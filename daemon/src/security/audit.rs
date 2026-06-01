use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct AuditEvent {
    pub event_type: String,
    pub actor: String,
    pub target: String,
    pub at_unix_ms: u128,
}

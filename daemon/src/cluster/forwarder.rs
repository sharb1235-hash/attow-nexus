#[derive(Debug, Clone)]
pub struct ForwarderStatus {
    pub primary_addr: Option<String>,
    pub connected: bool,
}

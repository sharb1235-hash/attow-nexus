#[derive(Debug, Clone)]
pub struct PrimaryConfig {
    pub durable_writes_owned: bool,
}

impl Default for PrimaryConfig {
    fn default() -> Self {
        Self {
            durable_writes_owned: true,
        }
    }
}

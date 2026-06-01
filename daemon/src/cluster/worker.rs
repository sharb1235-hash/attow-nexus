#[derive(Debug, Clone)]
pub struct WorkerConfig {
    pub forwards_durable_deltas: bool,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            forwards_durable_deltas: true,
        }
    }
}

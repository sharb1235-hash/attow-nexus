pub const ADMIN_METRICS: &str = "admin:metrics";
pub const ADMIN_AGENTS: &str = "admin:agents";
pub const ADMIN_SHUTDOWN: &str = "admin:shutdown";

pub fn channel_read(pattern: &str) -> String {
    format!("channel:read:{pattern}")
}

pub fn channel_write(pattern: &str) -> String {
    format!("channel:write:{pattern}")
}

pub fn channel_checkpoint(pattern: &str) -> String {
    format!("channel:checkpoint:{pattern}")
}

pub fn ledger_read(run_id: &str) -> String {
    format!("ledger:read:{run_id}")
}

pub fn ledger_fork(run_id: &str) -> String {
    format!("ledger:fork:{run_id}")
}

pub fn ledger_rollback(run_id: &str) -> String {
    format!("ledger:rollback:{run_id}")
}

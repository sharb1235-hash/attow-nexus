pub fn head_key(run_id: &str, thread_id: &str, agent_id: &str, channel: &str) -> String {
    format!("{run_id}\u{1f}{thread_id}\u{1f}{agent_id}\u{1f}{channel}")
}

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

use crate::generated::nexus::v1::{Commit, LoopWarning};
use crate::loop_detection::fingerprints::fingerprint;
use crate::loop_detection::heuristics::severity_for_repetitions;
use crate::util::ids::new_id;
use crate::util::time::now;

#[derive(Debug, Clone)]
struct FingerprintEntry {
    fingerprint: String,
    commit_id: String,
}

#[derive(Debug)]
pub struct LoopDetector {
    window_size: usize,
    windows: Mutex<HashMap<String, VecDeque<FingerprintEntry>>>,
}

impl Default for LoopDetector {
    fn default() -> Self {
        Self::new(12)
    }
}

impl LoopDetector {
    pub fn new(window_size: usize) -> Self {
        Self {
            window_size,
            windows: Mutex::new(HashMap::new()),
        }
    }

    pub fn inspect(&self, commit: &Commit) -> Option<LoopWarning> {
        let key = format!("{}|{}|{}", commit.run_id, commit.agent_id, commit.channel);
        let fingerprint = fingerprint(commit);
        let mut windows = self.windows.lock().expect("loop detector lock");
        let window = windows.entry(key).or_default();
        let repetition_count = window
            .iter()
            .filter(|entry| entry.fingerprint == fingerprint)
            .count() as u64
            + 1;
        let suggested_stable_commit_id = window
            .iter()
            .rev()
            .find(|entry| entry.fingerprint != fingerprint)
            .map(|entry| entry.commit_id.clone())
            .unwrap_or_default();

        if window.len() == self.window_size {
            window.pop_front();
        }
        window.push_back(FingerprintEntry {
            fingerprint: fingerprint.clone(),
            commit_id: commit.commit_id.clone(),
        });

        if repetition_count < 3 {
            return None;
        }

        let at = now();
        let severity = severity_for_repetitions(repetition_count);
        Some(LoopWarning {
            warning_id: new_id("loop"),
            run_id: commit.run_id.clone(),
            agent_id: commit.agent_id.clone(),
            channel: commit.channel.clone(),
            severity: severity as i32,
            fingerprint,
            repetition_count,
            first_seen: Some(at),
            last_seen: Some(at),
            suggested_stable_commit_id,
            message: "Repeated captured context and tool pattern detected in the sliding window."
                .to_string(),
        })
    }
}

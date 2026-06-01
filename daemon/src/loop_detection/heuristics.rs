use crate::generated::nexus::v1::LoopSeverity;

pub fn severity_for_repetitions(repetitions: u64) -> LoopSeverity {
    match repetitions {
        0..=2 => LoopSeverity::Low,
        3..=4 => LoopSeverity::Medium,
        _ => LoopSeverity::High,
    }
}

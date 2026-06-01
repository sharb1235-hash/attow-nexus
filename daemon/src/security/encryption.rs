#[derive(Debug, Clone)]
pub struct EncryptionStatus {
    pub enabled: bool,
    pub message: &'static str,
}

pub fn status(enabled: bool) -> EncryptionStatus {
    EncryptionStatus {
        enabled,
        message: if enabled {
            "encryption-at-rest is configured by the local deployment"
        } else {
            "encryption-at-rest is disabled by default for the local MVP"
        },
    }
}

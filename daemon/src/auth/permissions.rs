use crate::config::Config;
use crate::generated::nexus::v1::PermissionScope;

pub fn grant_requested(config: &Config, requested: &[PermissionScope]) -> Vec<PermissionScope> {
    if !config.require_auth {
        return vec![PermissionScope {
            value: "*".to_string(),
        }];
    }
    if requested.is_empty() {
        return vec![
            PermissionScope {
                value: "channel:read:*".to_string(),
            },
            PermissionScope {
                value: "channel:write:*".to_string(),
            },
            PermissionScope {
                value: "channel:checkpoint:*".to_string(),
            },
            PermissionScope {
                value: "ledger:read:*".to_string(),
            },
        ];
    }
    requested.to_vec()
}

pub fn is_allowed(config: &Config, granted: &[PermissionScope], required: &str) -> bool {
    if !config.require_auth {
        return true;
    }
    granted
        .iter()
        .any(|scope| scope_matches(&scope.value, required))
}

fn scope_matches(scope: &str, required: &str) -> bool {
    if scope == "*" || scope == required {
        return true;
    }
    if let Some(prefix) = scope.strip_suffix('*') {
        required.starts_with(prefix)
    } else {
        false
    }
}

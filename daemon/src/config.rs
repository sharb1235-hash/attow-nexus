use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::OnceLock;

use anyhow::{bail, Context};

#[derive(Clone, Debug)]
pub struct Config {
    pub data_dir: PathBuf,
    pub bind_mode: String,
    pub grpc_addr: SocketAddr,
    pub uds_path: PathBuf,
    pub windows_pipe_name: String,
    pub http_addr: SocketAddr,
    pub metrics_addr: SocketAddr,
    pub auth_token: Option<String>,
    pub require_auth: bool,
    pub allow_remote: bool,
    pub store: String,
    pub sqlite_path: PathBuf,
    pub rocksdb_path: PathBuf,
    pub artifact_dir: PathBuf,
    pub compression_threshold_bytes: usize,
    pub max_inline_payload_bytes: usize,
    pub persist_ephemeral: bool,
    pub redaction_enabled: bool,
    pub encryption_at_rest: bool,
    pub loop_detection_enabled: bool,
    pub mcp_enabled: bool,
    pub otel_enabled: bool,
    pub cluster_enabled: bool,
    pub cluster_role: String,
    pub cluster_primary_addr: Option<String>,
    pub cluster_shared_token: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let data_dir = expand_tilde(&env_or("NEXUS_DATA_DIR", "~/.nexus"));
        Ok(Self {
            data_dir: data_dir.clone(),
            bind_mode: env_or("NEXUS_BIND_MODE", if cfg!(windows) { "tcp" } else { "uds" }),
            grpc_addr: env_or("NEXUS_GRPC_ADDR", "127.0.0.1:7821")
                .parse()
                .context("parse NEXUS_GRPC_ADDR")?,
            uds_path: expand_tilde(&env_or("NEXUS_UDS_PATH", "/tmp/nexus.sock")),
            windows_pipe_name: env_or("NEXUS_WINDOWS_PIPE_NAME", r"\\.\pipe\nexus"),
            http_addr: env_or("NEXUS_HTTP_ADDR", "127.0.0.1:7822")
                .parse()
                .context("parse NEXUS_HTTP_ADDR")?,
            metrics_addr: env_or("NEXUS_METRICS_ADDR", "127.0.0.1:7823")
                .parse()
                .context("parse NEXUS_METRICS_ADDR")?,
            auth_token: optional_env("NEXUS_AUTH_TOKEN"),
            require_auth: env_bool("NEXUS_REQUIRE_AUTH", true),
            allow_remote: env_bool("NEXUS_ALLOW_REMOTE", false),
            store: env_or("NEXUS_STORE", "sqlite"),
            sqlite_path: expand_tilde(&env_or("NEXUS_SQLITE_PATH", "~/.nexus/nexus.sqlite")),
            rocksdb_path: expand_tilde(&env_or("NEXUS_ROCKSDB_PATH", "~/.nexus/rocksdb")),
            artifact_dir: expand_tilde(&env_or("NEXUS_ARTIFACT_DIR", "~/.nexus/artifacts")),
            compression_threshold_bytes: env_usize("NEXUS_COMPRESSION_THRESHOLD_BYTES", 4096),
            max_inline_payload_bytes: env_usize("NEXUS_MAX_INLINE_PAYLOAD_BYTES", 65_536),
            persist_ephemeral: env_bool("NEXUS_PERSIST_EPHEMERAL", false),
            redaction_enabled: env_bool("NEXUS_REDACTION_ENABLED", true),
            encryption_at_rest: env_bool("NEXUS_ENCRYPTION_AT_REST", false),
            loop_detection_enabled: env_bool("NEXUS_LOOP_DETECTION_ENABLED", true),
            mcp_enabled: env_bool("NEXUS_MCP_ENABLED", false),
            otel_enabled: env_bool("NEXUS_OTEL_ENABLED", false),
            cluster_enabled: env_bool("NEXUS_CLUSTER_ENABLED", false),
            cluster_role: env_or("NEXUS_CLUSTER_ROLE", "primary"),
            cluster_primary_addr: optional_env("NEXUS_CLUSTER_PRIMARY_ADDR"),
            cluster_shared_token: optional_env("NEXUS_CLUSTER_SHARED_TOKEN"),
        })
    }

    pub fn prepare(&self) -> anyhow::Result<()> {
        std::fs::create_dir_all(&self.data_dir)?;
        std::fs::create_dir_all(&self.artifact_dir)?;
        if let Some(parent) = self.sqlite_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if self.store == "rocksdb" && !cfg!(feature = "rocksdb-store") {
            bail!("NEXUS_STORE=rocksdb requires building with --features rocksdb-store");
        }
        Ok(())
    }

    pub fn validate_network_policy(&self) -> anyhow::Result<()> {
        if !self.allow_remote {
            for (name, addr) in [
                ("NEXUS_GRPC_ADDR", self.grpc_addr),
                ("NEXUS_HTTP_ADDR", self.http_addr),
                ("NEXUS_METRICS_ADDR", self.metrics_addr),
            ] {
                if !addr.ip().is_loopback() {
                    bail!("{name} must bind to a loopback address unless NEXUS_ALLOW_REMOTE=true");
                }
            }
        }

        if self.bind_mode == "tcp" && self.require_auth && self.auth_token.is_none() {
            bail!("TCP mode requires NEXUS_AUTH_TOKEN unless NEXUS_REQUIRE_AUTH=false");
        }
        Ok(())
    }
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key)
        .ok()
        .or_else(|| file_value(key))
        .unwrap_or_else(|| default.to_string())
}

fn optional_env(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .or_else(|| file_value(key))
        .filter(|value| !value.trim().is_empty())
}

fn env_bool(key: &str, default: bool) -> bool {
    env::var(key)
        .ok()
        .or_else(|| file_value(key))
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "on"))
        .unwrap_or(default)
}

fn env_usize(key: &str, default: usize) -> usize {
    env::var(key)
        .ok()
        .or_else(|| file_value(key))
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn file_value(env_key: &str) -> Option<String> {
    static CONFIG: OnceLock<Option<toml::Value>> = OnceLock::new();
    let config = CONFIG.get_or_init(|| {
        std::fs::read_to_string("nexus.toml")
            .ok()
            .and_then(|text| text.parse::<toml::Value>().ok())
    });
    let key = env_key
        .strip_prefix("NEXUS_")
        .unwrap_or(env_key)
        .to_ascii_lowercase();
    let value = config.as_ref()?.get(&key)?;
    match value {
        toml::Value::String(text) => Some(text.clone()),
        toml::Value::Integer(number) => Some(number.to_string()),
        toml::Value::Boolean(boolean) => Some(boolean.to_string()),
        _ => None,
    }
}

fn expand_tilde(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = env::var_os("USERPROFILE").or_else(|| env::var_os("HOME")) {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

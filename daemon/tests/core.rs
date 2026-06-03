use std::net::SocketAddr;
use std::sync::Arc;

use axum::http::{HeaderMap, HeaderValue, StatusCode};
use nexusd::auth::token;
use nexusd::bus::Bus;
use nexusd::config::Config;
use nexusd::generated::nexus::v1::{
    AgentCapabilities, AgentMetadata, CheckpointRequest, Commit, Payload, PayloadEncoding,
    PublishDeltaRequest, RegisterAgentRequest, StateDelta, SubscriptionFilter,
};
use nexusd::grpc::service::AppState;
use nexusd::ledger::dag::DagIndex;
use nexusd::ledger::sqlite_store::SqliteStore;
use nexusd::ledger::store::Store;
use nexusd::observability::metrics::Metrics;
use nexusd::util::hash::blake3_hex;
use nexusd::util::time::now;

fn test_config(dir: &tempfile::TempDir) -> Config {
    Config {
        data_dir: dir.path().to_path_buf(),
        bind_mode: "tcp".to_string(),
        grpc_addr: "127.0.0.1:0".parse().unwrap(),
        uds_path: dir.path().join("nexus.sock"),
        windows_pipe_name: r"\\.\pipe\nexus-test".to_string(),
        http_addr: "127.0.0.1:0".parse().unwrap(),
        metrics_addr: "127.0.0.1:0".parse().unwrap(),
        auth_token: None,
        require_auth: false,
        allow_remote: false,
        store: "sqlite".to_string(),
        sqlite_path: dir.path().join("nexus.sqlite"),
        rocksdb_path: dir.path().join("rocksdb"),
        artifact_dir: dir.path().join("artifacts"),
        compression_threshold_bytes: 16,
        max_inline_payload_bytes: 128,
        persist_ephemeral: false,
        redaction_enabled: true,
        encryption_at_rest: false,
        loop_detection_enabled: true,
        mcp_enabled: false,
        otel_enabled: false,
        cluster_enabled: false,
        cluster_role: "primary".to_string(),
        cluster_primary_addr: None,
        cluster_shared_token: None,
    }
}

fn state(dir: &tempfile::TempDir) -> AppState {
    let config = test_config(dir);
    config.prepare().unwrap();
    let store = Arc::new(SqliteStore::open(&config).unwrap());
    let dag = Arc::new(DagIndex::from_commits(&[]).unwrap());
    let metrics = Arc::new(Metrics::default());
    let bus = Arc::new(Bus::new(metrics.clone()));
    AppState::new(config, bus, store, dag, metrics)
}

#[tokio::test]
async fn register_publish_diff_replay_fork_and_rollback() {
    let dir = tempfile::tempdir().unwrap();
    let state = state(&dir);
    let registration = state.register_agent_inner(RegisterAgentRequest {
        agent_id: "researcher".to_string(),
        run_id: "run-1".to_string(),
        thread_id: String::new(),
        metadata: Some(AgentMetadata {
            framework: "custom".to_string(),
            language: "rust-test".to_string(),
            metadata: None,
        }),
        capabilities: Some(AgentCapabilities {
            capabilities: vec!["research".to_string()],
        }),
        requested_scopes: Vec::new(),
    });
    assert!(registration.accepted);

    let ephemeral = state
        .publish_delta_inner(PublishDeltaRequest {
            delta: Some(delta(false, "topic:research", r#"{"step":1}"#)),
            parent_commit_ids: Vec::new(),
            objective: "test".to_string(),
        })
        .await
        .unwrap();
    assert!(!ephemeral.persisted);

    let first = state
        .checkpoint_inner(CheckpointRequest {
            agent_id: "researcher".to_string(),
            run_id: "run-1".to_string(),
            thread_id: String::new(),
            channel: "topic:research".to_string(),
            objective: "test".to_string(),
            payload: Some(json_payload(
                r#"{"step":1,"finding":"a","plan":"find source"}"#,
            )),
            parent_commit_ids: Vec::new(),
            tags: vec!["research".to_string()],
            summary: "first".to_string(),
            metadata: None,
            tool_calls: Vec::new(),
            tool_results: Vec::new(),
            artifact_refs: Vec::new(),
            external_side_effects: Vec::new(),
        })
        .await
        .unwrap();
    let second = state
        .checkpoint_inner(CheckpointRequest {
            agent_id: "researcher".to_string(),
            run_id: "run-1".to_string(),
            thread_id: String::new(),
            channel: "topic:research".to_string(),
            objective: "test".to_string(),
            payload: Some(json_payload(r#"{"step":2,"finding":"b"}"#)),
            parent_commit_ids: vec![first.commit_id.clone()],
            tags: vec!["research".to_string()],
            summary: "second".to_string(),
            metadata: None,
            tool_calls: Vec::new(),
            tool_results: Vec::new(),
            artifact_refs: Vec::new(),
            external_side_effects: Vec::new(),
        })
        .await
        .unwrap();

    assert!(state.store.get_commit(&first.commit_id).unwrap().is_some());
    let diff = state
        .diff_inner(nexusd::generated::nexus::v1::DiffCommitsRequest {
            from_commit_id: first.commit_id.clone(),
            to_commit_id: second.commit_id.clone(),
            from_nearest_common_ancestor: false,
        })
        .unwrap();
    assert!(!diff.entries.is_empty());

    let replay = state
        .replay_inner(nexusd::generated::nexus::v1::ReplayRequest {
            commit_id: second.commit_id.clone(),
            mode: nexusd::generated::nexus::v1::ReplayMode::StateOnly as i32,
            confirm_reexecute_tools: false,
        })
        .unwrap();
    assert_eq!(replay.provenance_commit_ids.len(), 2);
    let replay_payload = replay.reconstructed_state.unwrap();
    let replay_state: serde_json::Value = serde_json::from_slice(&replay_payload.data).unwrap();
    assert_eq!(replay_state["step"], 2);
    assert_eq!(replay_state["finding"], "b");
    assert_eq!(replay_state["plan"], "find source");

    let fork = state
        .fork_inner(nexusd::generated::nexus::v1::ForkRequest {
            source_commit_id: first.commit_id.clone(),
            new_run_id: "run-branch".to_string(),
            metadata: None,
        })
        .unwrap();
    assert_eq!(fork.run_id, "run-branch");

    let rollback = state
        .rollback_inner(nexusd::generated::nexus::v1::RollbackRequest {
            head_commit_id: second.commit_id,
            target_commit_id: first.commit_id,
            force: false,
        })
        .unwrap();
    assert!(rollback.moved);
}

#[tokio::test]
async fn subscription_filters_and_backpressure_work() {
    let metrics = Arc::new(Metrics::default());
    let bus = Bus::new(metrics);
    let mut receiver = bus.subscribe(
        "sub".to_string(),
        SubscriptionFilter {
            channel_patterns: vec!["topic:*".to_string()],
            durable_only: false,
            tags: Vec::new(),
        },
        1,
    );
    bus.broadcast(delta(false, "topic:a", r#"{"x":1}"#), String::new())
        .await;
    assert!(receiver.try_recv().is_ok());
    bus.broadcast(delta(false, "agent:a", r#"{"x":1}"#), String::new())
        .await;
    assert!(receiver.try_recv().is_err());
    bus.broadcast(delta(false, "topic:a", r#"{"x":2}"#), String::new())
        .await;
    bus.broadcast(delta(false, "topic:a", r#"{"x":3}"#), String::new())
        .await;
    assert!(bus.dropped_for("sub") >= 1);
}

#[tokio::test]
async fn redaction_and_artifacts_are_applied() {
    let dir = tempfile::tempdir().unwrap();
    let state = state(&dir);
    let large_secret = format!(
        "{{\"api_key\":\"sk-{}\",\"payload\":\"{}\"}}",
        "a".repeat(32),
        "x".repeat(256)
    );
    let response = state
        .checkpoint_inner(CheckpointRequest {
            agent_id: "redactor".to_string(),
            run_id: "run-redact".to_string(),
            thread_id: String::new(),
            channel: "topic:redaction".to_string(),
            objective: String::new(),
            payload: Some(json_payload(&large_secret)),
            parent_commit_ids: Vec::new(),
            tags: Vec::new(),
            summary: "redact".to_string(),
            metadata: None,
            tool_calls: Vec::new(),
            tool_results: Vec::new(),
            artifact_refs: Vec::new(),
            external_side_effects: Vec::new(),
        })
        .await
        .unwrap();
    assert!(response.redaction_report.unwrap().redacted);
    assert_eq!(state.metrics.summary().nexus_artifacts_total, 1);
    let commit = state
        .store
        .get_commit(&response.commit_id)
        .unwrap()
        .unwrap();
    assert!(!commit.artifact_refs.is_empty());
    let bytes = state
        .store
        .get_artifact(&commit.artifact_refs[0].artifact_id)
        .unwrap()
        .unwrap();
    assert!(String::from_utf8_lossy(&bytes).contains("[REDACTED]"));
}

#[test]
fn dag_rejects_cycles_and_remote_bind_is_rejected() {
    let dag = DagIndex::from_commits(&[]).unwrap();
    let commit = Commit {
        commit_id: "c1".to_string(),
        parent_commit_ids: vec!["c1".to_string()],
        ..Commit::default()
    };
    assert!(dag.append(&commit).is_err());

    let dir = tempfile::tempdir().unwrap();
    let mut config = test_config(&dir);
    config.grpc_addr = SocketAddr::from(([0, 0, 0, 0], 7821));
    assert!(config.validate_network_policy().is_err());
}

#[test]
fn http_bearer_token_auth_accepts_only_expected_token() {
    let dir = tempfile::tempdir().unwrap();
    let mut config = test_config(&dir);
    config.require_auth = true;
    config.auth_token = Some("audit-token".to_string());

    let headers = HeaderMap::new();
    assert_eq!(
        token::validate_http(&headers, &config),
        Err(StatusCode::UNAUTHORIZED)
    );

    let mut wrong = HeaderMap::new();
    wrong.insert(
        axum::http::header::AUTHORIZATION,
        HeaderValue::from_static("Bearer wrong-token"),
    );
    assert_eq!(
        token::validate_http(&wrong, &config),
        Err(StatusCode::FORBIDDEN)
    );

    let mut correct = HeaderMap::new();
    correct.insert(
        axum::http::header::AUTHORIZATION,
        HeaderValue::from_static("Bearer audit-token"),
    );
    assert!(token::validate_http(&correct, &config).is_ok());
}

fn delta(durable: bool, channel: &str, json: &str) -> StateDelta {
    StateDelta {
        delta_id: String::new(),
        channel: channel.to_string(),
        agent_id: "researcher".to_string(),
        run_id: "run-1".to_string(),
        thread_id: String::new(),
        logical_clock: 1,
        wall_time: Some(now()),
        payload: Some(json_payload(json)),
        durable,
        tags: Vec::new(),
        summary: "delta".to_string(),
        metadata: None,
    }
}

fn json_payload(json: &str) -> Payload {
    let bytes = json.as_bytes().to_vec();
    Payload {
        encoding: PayloadEncoding::Json as i32,
        data: bytes.clone(),
        struct_data: None,
        size_bytes: bytes.len() as u64,
        content_hash: blake3_hex(&bytes),
        compressed: false,
        artifact_ref: String::new(),
    }
}

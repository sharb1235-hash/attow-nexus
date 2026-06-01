use std::collections::HashMap;
use std::time::Duration;

use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::Stream;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio_stream::StreamExt;
use tower_http::cors::CorsLayer;

use crate::auth::token;
use crate::generated::nexus::v1::{
    AgentCapabilities, AgentMetadata, CheckpointRequest, Commit, DiffCommitsRequest,
    ExternalSideEffect, ForkRequest, Metadata, Payload, PayloadEncoding, PublishDeltaRequest,
    RegisterAgentRequest, ReplayMode, ReplayRequest, RollbackRequest, StateDelta,
};
use crate::grpc::service::AppState;
use crate::ledger::diff::payload_to_json;
use crate::ledger::store::Store;
use crate::observability::metrics::MetricsSummary;
use crate::util::hash::blake3_hex;
use crate::util::ids::new_id;
use crate::util::time::now;

type ApiResult<T> = Result<Json<T>, (StatusCode, String)>;

pub async fn serve(listener: TcpListener, state: AppState) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/agents", get(agents))
        .route("/api/agents/register", post(register_agent))
        .route("/api/channels", get(channels))
        .route("/api/channels/:channel/snapshot", get(channel_snapshot))
        .route("/api/channels/:channel/deltas", get(channel_deltas))
        .route("/api/deltas", post(publish_delta))
        .route("/api/checkpoint", post(checkpoint))
        .route("/api/runs", get(runs))
        .route("/api/runs/:run_id/commits", get(run_commits))
        .route("/api/commits/:commit_id", get(commit))
        .route("/api/diff", get(diff_query))
        .route("/api/replay", post(replay))
        .route("/api/fork", post(fork))
        .route("/api/rollback", post(rollback))
        .route("/api/loop-warnings", get(loop_warnings))
        .route("/api/metrics-summary", get(metrics_summary))
        .route("/api/events/stream", get(events_stream))
        .layer(CorsLayer::permissive())
        .with_state(state);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    let health = state.health();
    Json(json!({
        "status": health.status,
        "daemonVersion": health.daemon_version,
        "protocolVersion": health.protocol_version,
        "authRequired": health.auth_required,
        "bindMode": health.bind_mode,
        "localOnly": state.config.grpc_addr.ip().is_loopback()
    }))
}

async fn agents(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Vec<crate::bus::AgentInfo>> {
    guard(&state, &headers)?;
    Ok(Json(state.bus.agents()))
}

async fn register_agent(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RegisterAgentBody>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let request = RegisterAgentRequest {
        agent_id: body.agent_id,
        run_id: body.run_id,
        thread_id: body.thread_id.unwrap_or_default(),
        metadata: Some(AgentMetadata {
            framework: body.framework.unwrap_or_else(|| "custom".to_string()),
            language: body.language.unwrap_or_default(),
            metadata: Some(metadata_from_map(body.metadata)),
        }),
        capabilities: Some(AgentCapabilities {
            capabilities: body.capabilities,
        }),
        requested_scopes: Vec::new(),
    };
    let response = state.register_agent_inner(request);
    Ok(Json(json!({
        "accepted": response.accepted,
        "agentId": response.agent_id,
        "protocolVersion": response.protocol_version,
        "grantedScopes": response.granted_scopes.into_iter().map(|scope| scope.value).collect::<Vec<_>>()
    })))
}

async fn channels(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Vec<crate::bus::ChannelInfo>> {
    guard(&state, &headers)?;
    Ok(Json(state.bus.channels()))
}

async fn channel_snapshot(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(channel): Path<String>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let snapshot = state.bus.snapshot(&channel);
    Ok(Json(json!({
        "channel": snapshot.channel,
        "latestPayload": payload_to_json(snapshot.latest_payload.as_ref()),
        "durableCount": snapshot.durable_count,
        "ephemeralCount": snapshot.ephemeral_count
    })))
}

async fn channel_deltas(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(channel): Path<String>,
) -> ApiResult<Vec<crate::bus::DeltaInfo>> {
    guard(&state, &headers)?;
    Ok(Json(state.bus.recent_deltas(Some(&channel))))
}

async fn publish_delta(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<PublishDeltaBody>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let payload = payload_from_json(body.delta)?;
    let request = PublishDeltaRequest {
        delta: Some(StateDelta {
            delta_id: new_id("delta"),
            channel: body.channel,
            agent_id: body.agent_id,
            run_id: body.run_id,
            thread_id: body.thread_id.unwrap_or_default(),
            logical_clock: body.logical_clock.unwrap_or_default(),
            wall_time: Some(now()),
            payload: Some(payload),
            durable: body.durable,
            tags: body.tags,
            summary: body.summary.unwrap_or_default(),
            metadata: Some(metadata_from_map(body.metadata)),
        }),
        parent_commit_ids: body.parent_commit_ids,
        objective: body.objective.unwrap_or_default(),
    };
    let response = state
        .publish_delta_inner(request)
        .await
        .map_err(internal_error)?;
    Ok(Json(json!({
        "deltaId": response.delta_id,
        "commitId": response.commit_id,
        "accepted": response.accepted,
        "persisted": response.persisted,
        "warning": response.warning,
        "redacted": response.redaction_report.map(|report| report.redacted).unwrap_or(false)
    })))
}

async fn checkpoint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CheckpointBody>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let request = CheckpointRequest {
        agent_id: body.agent_id,
        run_id: body.run_id,
        thread_id: body.thread_id.unwrap_or_default(),
        channel: body.channel,
        objective: body.objective.unwrap_or_default(),
        payload: Some(payload_from_json(body.state)?),
        parent_commit_ids: body.parent_commit_ids,
        tags: body.tags,
        summary: body.summary.unwrap_or_default(),
        metadata: Some(metadata_from_map(body.metadata)),
        tool_calls: Vec::new(),
        tool_results: Vec::new(),
        artifact_refs: Vec::new(),
        external_side_effects: body
            .external_side_effects
            .unwrap_or_default()
            .into_iter()
            .map(SideEffectBody::into_proto)
            .collect(),
    };
    let response = state
        .checkpoint_inner(request)
        .await
        .map_err(internal_error)?;
    Ok(Json(json!({
        "commitId": response.commit_id,
        "deltaId": response.delta_id,
        "accepted": response.accepted,
        "persisted": response.persisted,
        "warning": response.warning,
        "redacted": response.redaction_report.map(|report| report.redacted).unwrap_or(false)
    })))
}

async fn runs(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Vec<Value>> {
    guard(&state, &headers)?;
    let runs = state.store.list_runs().map_err(internal_error)?;
    Ok(Json(
        runs.into_iter()
            .map(|run| {
                json!({
                    "runId": run.run_id,
                    "commitCount": run.commit_count,
                    "lastCommitAt": run.last_commit_at.map(|ts| ts.seconds)
                })
            })
            .collect(),
    ))
}

async fn run_commits(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(run_id): Path<String>,
) -> ApiResult<Vec<Value>> {
    guard(&state, &headers)?;
    let commits = state
        .store
        .list_commits(Some(&run_id), None, None)
        .map_err(internal_error)?;
    Ok(Json(commits.iter().map(commit_summary).collect()))
}

async fn commit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(commit_id): Path<String>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let commit = state.get_commit_inner(&commit_id).map_err(internal_error)?;
    Ok(Json(commit_detail(&commit)))
}

async fn diff_query(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<DiffQuery>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let diff = state
        .diff_inner(DiffCommitsRequest {
            from_commit_id: query.from,
            to_commit_id: query.to,
            from_nearest_common_ancestor: query.from_nearest_common_ancestor.unwrap_or(false),
        })
        .map_err(internal_error)?;
    Ok(Json(json!({
        "fromCommitId": diff.from_commit_id,
        "toCommitId": diff.to_commit_id,
        "humanSummary": diff.human_summary,
        "entries": diff.entries.into_iter().map(|entry| json!({
            "path": entry.path,
            "changeType": entry.change_type,
            "before": serde_json::from_str::<Value>(&entry.before_json).unwrap_or(Value::String(entry.before_json)),
            "after": serde_json::from_str::<Value>(&entry.after_json).unwrap_or(Value::String(entry.after_json))
        })).collect::<Vec<_>>()
    })))
}

async fn replay(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ReplayBody>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let mode = match body.mode.as_deref() {
        Some("dry_run_tools") => ReplayMode::DryRunTools,
        Some("reexecute_tools") => ReplayMode::ReexecuteTools,
        _ => ReplayMode::StateOnly,
    };
    let result = state
        .replay_inner(ReplayRequest {
            commit_id: body.commit_id,
            mode: mode as i32,
            confirm_reexecute_tools: body.confirm_reexecute_tools.unwrap_or(false),
        })
        .map_err(internal_error)?;
    Ok(Json(json!({
        "commitId": result.commit_id,
        "reconstructedState": payload_to_json(result.reconstructed_state.as_ref()),
        "sideEffectWarnings": result.side_effect_warnings,
        "provenanceCommitIds": result.provenance_commit_ids,
        "missingArtifactWarnings": result.missing_artifact_warnings
    })))
}

async fn fork(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ForkBody>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let result = state
        .fork_inner(ForkRequest {
            source_commit_id: body.source_commit_id,
            new_run_id: body.new_run_id.unwrap_or_default(),
            metadata: None,
        })
        .map_err(internal_error)?;
    Ok(Json(json!({
        "sourceCommitId": result.source_commit_id,
        "runId": result.run_id,
        "headCommitId": result.head_commit_id
    })))
}

async fn rollback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RollbackBody>,
) -> ApiResult<Value> {
    guard(&state, &headers)?;
    let result = state
        .rollback_inner(RollbackRequest {
            head_commit_id: body.head_commit_id,
            target_commit_id: body.target_commit_id,
            force: body.force.unwrap_or(false),
        })
        .map_err(internal_error)?;
    Ok(Json(json!({
        "moved": result.moved,
        "previousHeadCommitId": result.previous_head_commit_id,
        "newHeadCommitId": result.new_head_commit_id,
        "warnings": result.warnings
    })))
}

async fn loop_warnings(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Vec<Value>> {
    guard(&state, &headers)?;
    let warnings = state.store.list_loop_warnings().map_err(internal_error)?;
    Ok(Json(
        warnings
            .into_iter()
            .map(|warning| {
                json!({
                    "warningId": warning.warning_id,
                    "runId": warning.run_id,
                    "agentId": warning.agent_id,
                    "channel": warning.channel,
                    "severity": warning.severity,
                    "fingerprint": warning.fingerprint,
                    "repetitionCount": warning.repetition_count,
                    "suggestedStableCommitId": warning.suggested_stable_commit_id,
                    "message": warning.message
                })
            })
            .collect(),
    ))
}

async fn metrics_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<MetricsSummary> {
    guard(&state, &headers)?;
    Ok(Json(state.metrics.summary()))
}

async fn events_stream(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let stream =
        tokio_stream::wrappers::IntervalStream::new(tokio::time::interval(Duration::from_secs(1)))
            .map(move |_| {
                let payload = json!({
                    "type": "summary",
                    "agents": state.bus.agent_count(),
                    "channels": state.bus.channel_count(),
                    "commits": state.metrics.commits_total.load(),
                    "loopWarnings": state.metrics.loop_warnings_total.load()
                });
                Ok(Event::default().event("nexus").data(payload.to_string()))
            });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

fn guard(state: &AppState, headers: &HeaderMap) -> Result<(), (StatusCode, String)> {
    token::validate_http(headers, &state.config).map_err(|status| {
        (
            status,
            "request is not authorized for this local Nexus daemon".to_string(),
        )
    })
}

fn payload_from_json(value: Value) -> Result<Payload, (StatusCode, String)> {
    let bytes = serde_json::to_vec(&value).map_err(|err| {
        (
            StatusCode::BAD_REQUEST,
            format!("payload must be JSON serializable: {err}"),
        )
    })?;
    Ok(Payload {
        encoding: PayloadEncoding::Json as i32,
        data: bytes.clone(),
        struct_data: None,
        size_bytes: bytes.len() as u64,
        content_hash: blake3_hex(&bytes),
        compressed: false,
        artifact_ref: String::new(),
    })
}

fn metadata_from_map(map: HashMap<String, String>) -> Metadata {
    Metadata {
        entries: map
            .into_iter()
            .map(|(key, value)| crate::generated::nexus::v1::KeyValue { key, value })
            .collect(),
    }
}

fn commit_summary(commit: &Commit) -> Value {
    json!({
        "commitId": commit.commit_id,
        "deltaId": commit.delta_id,
        "runId": commit.run_id,
        "threadId": commit.thread_id,
        "agentId": commit.agent_id,
        "channel": commit.channel,
        "logicalClock": commit.logical_clock,
        "wallTime": commit.wall_time.as_ref().map(|ts| ts.seconds),
        "summary": commit.summary,
        "tags": commit.tags,
        "parentCommitIds": commit.parent_commit_ids,
        "sideEffectCount": commit.external_side_effects.len()
    })
}

fn commit_detail(commit: &Commit) -> Value {
    let mut value = commit_summary(commit);
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "objective".to_string(),
            Value::String(commit.objective.clone()),
        );
        object.insert(
            "stateDelta".to_string(),
            payload_to_json(commit.state_delta.as_ref()),
        );
        object.insert(
            "toolCalls".to_string(),
            Value::Array(
                commit
                    .tool_calls
                    .iter()
                    .map(|tool| json!({"toolCallId": tool.tool_call_id, "name": tool.name}))
                    .collect(),
            ),
        );
        object.insert(
            "toolResults".to_string(),
            Value::Array(
                commit
                    .tool_results
                    .iter()
                    .map(|result| {
                        json!({
                            "toolCallId": result.tool_call_id,
                            "hasError": result.error.is_some()
                        })
                    })
                    .collect(),
            ),
        );
        object.insert(
            "artifacts".to_string(),
            Value::Array(
                commit
                    .artifact_refs
                    .iter()
                    .map(|artifact| {
                        json!({
                            "artifactId": artifact.artifact_id,
                            "contentHash": artifact.content_hash,
                            "sizeBytes": artifact.size_bytes,
                            "mediaType": artifact.media_type,
                            "compressed": artifact.compressed
                        })
                    })
                    .collect(),
            ),
        );
        object.insert(
            "externalSideEffects".to_string(),
            Value::Array(
                commit
                    .external_side_effects
                    .iter()
                    .map(|effect| {
                        json!({
                            "sideEffectId": effect.side_effect_id,
                            "kind": effect.kind,
                            "description": effect.description,
                            "target": effect.target,
                            "reversible": effect.reversible,
                            "compensatingActionAvailable": effect.compensating_action_available
                        })
                    })
                    .collect(),
            ),
        );
    }
    value
}

fn internal_error(err: anyhow::Error) -> (StatusCode, String) {
    let message = err.to_string();
    if message.contains("not found") {
        (StatusCode::NOT_FOUND, message)
    } else if message.contains("permission denied") {
        (StatusCode::FORBIDDEN, message)
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

#[derive(Debug, Deserialize)]
struct RegisterAgentBody {
    agent_id: String,
    run_id: String,
    thread_id: Option<String>,
    framework: Option<String>,
    language: Option<String>,
    #[serde(default)]
    capabilities: Vec<String>,
    #[serde(default)]
    metadata: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct PublishDeltaBody {
    channel: String,
    agent_id: String,
    run_id: String,
    thread_id: Option<String>,
    delta: Value,
    #[serde(default)]
    durable: bool,
    #[serde(default)]
    tags: Vec<String>,
    summary: Option<String>,
    objective: Option<String>,
    logical_clock: Option<u64>,
    #[serde(default)]
    parent_commit_ids: Vec<String>,
    #[serde(default)]
    metadata: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct CheckpointBody {
    agent_id: String,
    run_id: String,
    thread_id: Option<String>,
    channel: String,
    state: Value,
    summary: Option<String>,
    objective: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    parent_commit_ids: Vec<String>,
    #[serde(default)]
    metadata: HashMap<String, String>,
    external_side_effects: Option<Vec<SideEffectBody>>,
}

#[derive(Debug, Deserialize)]
struct SideEffectBody {
    side_effect_id: Option<String>,
    kind: String,
    description: Option<String>,
    target: Option<String>,
    payload_summary: Option<String>,
    reversible: Option<bool>,
    compensating_action_available: Option<bool>,
}

impl SideEffectBody {
    fn into_proto(self) -> ExternalSideEffect {
        ExternalSideEffect {
            side_effect_id: self.side_effect_id.unwrap_or_else(|| new_id("effect")),
            kind: self.kind,
            description: self.description.unwrap_or_default(),
            target: self.target.unwrap_or_default(),
            payload_summary: self.payload_summary.unwrap_or_default(),
            occurred_at: Some(now()),
            reversible: self.reversible.unwrap_or(false),
            compensating_action_available: self.compensating_action_available.unwrap_or(false),
            metadata: None,
        }
    }
}

#[derive(Debug, Deserialize)]
struct DiffQuery {
    from: String,
    to: String,
    from_nearest_common_ancestor: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ReplayBody {
    commit_id: String,
    mode: Option<String>,
    confirm_reexecute_tools: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ForkBody {
    source_commit_id: String,
    new_run_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RollbackBody {
    head_commit_id: String,
    target_commit_id: String,
    force: Option<bool>,
}

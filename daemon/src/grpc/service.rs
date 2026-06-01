use std::collections::HashMap;
use std::pin::Pin;
use std::sync::{Arc, RwLock};

use futures_util::{Stream, StreamExt};
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};

use crate::auth::{permissions, scopes};
use crate::bus::subscription::DEFAULT_SUBSCRIPTION_QUEUE;
use crate::bus::Bus;
use crate::config::Config;
use crate::generated::nexus::v1::nexus_service_server::NexusService;
use crate::generated::nexus::v1::{
    server_event, BroadcastDelta, ChannelSnapshotRequest, ChannelSnapshotResponse,
    CheckpointRequest, CheckpointResponse, Commit, CommitDiff, DiffCommitsRequest, Error,
    ExportRunRequest, ExportRunResponse, ForkRequest, ForkResult, GetCommitRequest, HealthRequest,
    HealthResponse, ListCommitsRequest, ListCommitsResponse, ListRunsRequest, ListRunsResponse,
    LoopWarning, Payload, PayloadEncoding, PublishDeltaRequest, PublishDeltaResponse,
    RedactionReport, RegisterAgentRequest, RegisterAgentResponse, ReplayRequest, ReplayResult,
    RollbackRequest, RollbackResponse, ServerEvent, StateDelta, SubscribeRequest,
    SubscriptionFilter,
};
use crate::ledger::commit::{self, CommitExtras};
use crate::ledger::dag::DagIndex;
use crate::ledger::diff;
use crate::ledger::fork;
use crate::ledger::replay;
use crate::ledger::rollback;
use crate::ledger::sqlite_store::SqliteStore;
use crate::ledger::store::Store;
use crate::loop_detection::detector::LoopDetector;
use crate::observability::metrics::Metrics;
use crate::security::redaction::Redactor;
use crate::util::hash::blake3_hex;
use crate::util::ids::new_id;
use crate::util::time::now;

type ResponseStream<T> = Pin<Box<dyn Stream<Item = Result<T, Status>> + Send + 'static>>;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub bus: Arc<Bus>,
    pub store: Arc<SqliteStore>,
    pub dag: Arc<DagIndex>,
    pub metrics: Arc<Metrics>,
    redactor: Redactor,
    loop_detector: Arc<LoopDetector>,
    grants: Arc<RwLock<HashMap<String, Vec<crate::generated::nexus::v1::PermissionScope>>>>,
}

impl AppState {
    pub fn new(
        config: Config,
        bus: Arc<Bus>,
        store: Arc<SqliteStore>,
        dag: Arc<DagIndex>,
        metrics: Arc<Metrics>,
    ) -> Self {
        Self {
            config,
            bus,
            store,
            dag,
            metrics,
            redactor: Redactor,
            loop_detector: Arc::new(LoopDetector::default()),
            grants: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn health(&self) -> HealthResponse {
        HealthResponse {
            status: "ok".to_string(),
            daemon_version: env!("CARGO_PKG_VERSION").to_string(),
            protocol_version: "nexus.v1".to_string(),
            auth_required: self.config.require_auth,
            bind_mode: self.config.bind_mode.clone(),
        }
    }

    pub fn register_agent_inner(&self, request: RegisterAgentRequest) -> RegisterAgentResponse {
        let granted = permissions::grant_requested(&self.config, &request.requested_scopes);
        self.grants
            .write()
            .expect("grants lock")
            .insert(request.agent_id.clone(), granted.clone());
        self.bus.register_agent(&request);
        RegisterAgentResponse {
            accepted: true,
            agent_id: request.agent_id,
            granted_scopes: granted,
            protocol_version: "nexus.v1".to_string(),
        }
    }

    pub async fn publish_delta_inner(
        &self,
        request: PublishDeltaRequest,
    ) -> anyhow::Result<PublishDeltaResponse> {
        let mut delta = request
            .delta
            .ok_or_else(|| anyhow::anyhow!("PublishDeltaRequest.delta is required"))?;
        normalize_delta(&mut delta);
        self.ensure_channel_permission(&delta.agent_id, &scopes::channel_write(&delta.channel))?;

        let (payload, redaction_report, artifact_refs) =
            self.prepare_payload(delta.payload.take())?;
        delta.payload = Some(payload.clone());

        if !delta.durable && !self.config.persist_ephemeral {
            self.bus.broadcast(delta.clone(), String::new()).await;
            return Ok(PublishDeltaResponse {
                delta_id: delta.delta_id,
                commit_id: String::new(),
                accepted: true,
                persisted: false,
                warning: String::new(),
                redaction_report: Some(redaction_report),
            });
        }

        let parents = self.resolve_parents(&delta, request.parent_commit_ids)?;
        let commit = commit::from_delta(
            &delta,
            parents,
            payload,
            redaction_report.clone(),
            CommitExtras {
                objective: request.objective,
                artifact_refs,
                sdk_name: "nexusd".to_string(),
                sdk_version: env!("CARGO_PKG_VERSION").to_string(),
                ..CommitExtras::default()
            },
        );
        self.persist_commit(&commit)?;
        self.bus
            .broadcast(delta.clone(), commit.commit_id.clone())
            .await;
        self.inspect_loop(&commit).await?;
        Ok(PublishDeltaResponse {
            delta_id: delta.delta_id,
            commit_id: commit.commit_id,
            accepted: true,
            persisted: true,
            warning: String::new(),
            redaction_report: Some(redaction_report),
        })
    }

    pub async fn checkpoint_inner(
        &self,
        request: CheckpointRequest,
    ) -> anyhow::Result<CheckpointResponse> {
        self.ensure_channel_permission(
            &request.agent_id,
            &scopes::channel_checkpoint(&request.channel),
        )?;
        let mut delta = StateDelta {
            delta_id: new_id("delta"),
            channel: request.channel.clone(),
            agent_id: request.agent_id.clone(),
            run_id: request.run_id.clone(),
            thread_id: request.thread_id.clone(),
            logical_clock: 0,
            wall_time: Some(now()),
            payload: Some(request.payload.unwrap_or_else(empty_json_payload)),
            durable: true,
            tags: request.tags.clone(),
            summary: request.summary.clone(),
            metadata: request.metadata.clone(),
        };
        normalize_delta(&mut delta);
        let (payload, redaction_report, mut artifact_refs) =
            self.prepare_payload(delta.payload.take())?;
        artifact_refs.extend(request.artifact_refs);
        delta.payload = Some(payload.clone());
        let parents = self.resolve_parents(&delta, request.parent_commit_ids)?;
        let commit = commit::from_delta(
            &delta,
            parents,
            payload,
            redaction_report.clone(),
            CommitExtras {
                objective: request.objective,
                tool_calls: request.tool_calls,
                tool_results: request.tool_results,
                artifact_refs,
                external_side_effects: request.external_side_effects,
                sdk_name: "nexusd".to_string(),
                sdk_version: env!("CARGO_PKG_VERSION").to_string(),
            },
        );
        self.persist_commit(&commit)?;
        self.bus
            .broadcast(delta.clone(), commit.commit_id.clone())
            .await;
        self.inspect_loop(&commit).await?;
        Ok(CheckpointResponse {
            commit_id: commit.commit_id,
            delta_id: delta.delta_id,
            accepted: true,
            persisted: true,
            warning: String::new(),
            redaction_report: Some(redaction_report),
        })
    }

    pub fn diff_inner(&self, request: DiffCommitsRequest) -> anyhow::Result<CommitDiff> {
        let from_id = if request.from_nearest_common_ancestor {
            self.dag
                .nearest_common_ancestor(&request.from_commit_id, &request.to_commit_id)
                .unwrap_or(request.from_commit_id)
        } else {
            request.from_commit_id
        };
        let from = self
            .store
            .get_commit(&from_id)?
            .ok_or_else(|| anyhow::anyhow!("from commit not found"))?;
        let to = self
            .store
            .get_commit(&request.to_commit_id)?
            .ok_or_else(|| anyhow::anyhow!("to commit not found"))?;
        Ok(diff::diff_commits(&from, &to))
    }

    pub fn replay_inner(&self, request: ReplayRequest) -> anyhow::Result<ReplayResult> {
        replay::replay(self.store.as_ref(), &request)
    }

    pub fn fork_inner(&self, request: ForkRequest) -> anyhow::Result<ForkResult> {
        fork::fork(self.store.as_ref(), &request)
    }

    pub fn rollback_inner(&self, request: RollbackRequest) -> anyhow::Result<RollbackResponse> {
        rollback::rollback(self.store.as_ref(), self.dag.as_ref(), &request)
    }

    pub fn list_runs_inner(&self) -> anyhow::Result<ListRunsResponse> {
        let runs = self.store.list_runs()?;
        Ok(ListRunsResponse { runs, page: None })
    }

    pub fn list_commits_inner(
        &self,
        request: ListCommitsRequest,
    ) -> anyhow::Result<ListCommitsResponse> {
        let commits = self.store.list_commits(
            nonempty(&request.run_id),
            nonempty(&request.thread_id),
            nonempty(&request.channel),
        )?;
        Ok(ListCommitsResponse {
            commits,
            page: None,
        })
    }

    pub fn get_commit_inner(&self, commit_id: &str) -> anyhow::Result<Commit> {
        self.store
            .get_commit(commit_id)?
            .ok_or_else(|| anyhow::anyhow!("commit not found"))
    }

    pub fn export_run_inner(&self, request: ExportRunRequest) -> anyhow::Result<ExportRunResponse> {
        let commits = self.store.list_commits(Some(&request.run_id), None, None)?;
        let value = serde_json::json!({
            "run_id": request.run_id,
            "format": if request.format.is_empty() { "json" } else { &request.format },
            "commit_count": commits.len(),
            "commits": commits.iter().map(|commit| {
                serde_json::json!({
                    "commit_id": commit.commit_id,
                    "delta_id": commit.delta_id,
                    "agent_id": commit.agent_id,
                    "channel": commit.channel,
                    "summary": commit.summary
                })
            }).collect::<Vec<_>>()
        });
        let bytes = serde_json::to_vec(&value)?;
        Ok(ExportRunResponse {
            run_id: value["run_id"].as_str().unwrap_or_default().to_string(),
            export_payload: Some(Payload {
                encoding: PayloadEncoding::Json as i32,
                size_bytes: bytes.len() as u64,
                content_hash: blake3_hex(&bytes),
                data: bytes,
                struct_data: None,
                compressed: false,
                artifact_ref: String::new(),
            }),
        })
    }

    fn ensure_channel_permission(&self, agent_id: &str, required: &str) -> anyhow::Result<()> {
        if !self.config.require_auth {
            return Ok(());
        }
        let grants = self.grants.read().expect("grants lock");
        let granted = grants.get(agent_id).cloned().unwrap_or_default();
        if permissions::is_allowed(&self.config, &granted, required) {
            Ok(())
        } else {
            anyhow::bail!("permission denied for {required}");
        }
    }

    fn prepare_payload(
        &self,
        payload: Option<Payload>,
    ) -> anyhow::Result<(
        Payload,
        RedactionReport,
        Vec<crate::generated::nexus::v1::ArtifactRef>,
    )> {
        let mut payload = payload.unwrap_or_else(empty_json_payload);
        if payload.content_hash.is_empty() {
            payload.content_hash = blake3_hex(&payload.data);
        }
        payload.size_bytes = payload.data.len() as u64;

        let redaction_report = if self.config.redaction_enabled {
            self.redactor.redact_payload(&mut payload)
        } else {
            RedactionReport {
                findings: Vec::new(),
                redacted: false,
            }
        };

        let mut artifact_refs = Vec::new();
        if payload.data.len() > self.config.max_inline_payload_bytes {
            let artifact = self
                .store
                .put_artifact(&payload.data, "application/octet-stream")?;
            payload.artifact_ref = artifact.artifact_id.clone();
            payload.data.clear();
            payload.size_bytes = artifact.size_bytes;
            payload.compressed = artifact.compressed;
            artifact_refs.push(artifact);
        }
        Ok((payload, redaction_report, artifact_refs))
    }

    fn resolve_parents(
        &self,
        delta: &StateDelta,
        explicit_parents: Vec<String>,
    ) -> anyhow::Result<Vec<String>> {
        if !explicit_parents.is_empty() {
            return Ok(explicit_parents);
        }
        Ok(self
            .store
            .get_head(
                &delta.run_id,
                &delta.thread_id,
                &delta.agent_id,
                &delta.channel,
            )?
            .into_iter()
            .collect())
    }

    fn persist_commit(&self, commit: &Commit) -> anyhow::Result<()> {
        self.dag.append(commit)?;
        self.store.append_commit(commit)?;
        self.store.set_head(
            &commit.run_id,
            &commit.thread_id,
            &commit.agent_id,
            &commit.channel,
            &commit.commit_id,
        )?;
        self.metrics.commits_total.inc();
        Ok(())
    }

    async fn inspect_loop(&self, commit: &Commit) -> anyhow::Result<()> {
        if !self.config.loop_detection_enabled {
            return Ok(());
        }
        if let Some(warning) = self.loop_detector.inspect(commit) {
            self.store.append_loop_warning(&warning)?;
            self.metrics.loop_warnings_total.inc();
            self.broadcast_loop_warning(warning).await?;
        }
        Ok(())
    }

    async fn broadcast_loop_warning(&self, warning: LoopWarning) -> anyhow::Result<()> {
        let bytes = serde_json::to_vec(&serde_json::json!({
            "warning_id": warning.warning_id,
            "run_id": warning.run_id,
            "agent_id": warning.agent_id,
            "channel": warning.channel,
            "severity": warning.severity,
            "fingerprint": warning.fingerprint,
            "repetition_count": warning.repetition_count,
            "suggested_stable_commit_id": warning.suggested_stable_commit_id,
            "message": warning.message
        }))?;
        let delta = StateDelta {
            delta_id: new_id("delta"),
            channel: "system:loop_warnings".to_string(),
            agent_id: "nexusd".to_string(),
            run_id: warning.run_id,
            thread_id: String::new(),
            logical_clock: 0,
            wall_time: Some(now()),
            payload: Some(Payload {
                encoding: PayloadEncoding::Json as i32,
                data: bytes.clone(),
                struct_data: None,
                size_bytes: bytes.len() as u64,
                content_hash: blake3_hex(&bytes),
                compressed: false,
                artifact_ref: String::new(),
            }),
            durable: false,
            tags: vec!["loop_warning".to_string()],
            summary: "Loop warning emitted".to_string(),
            metadata: None,
        };
        self.bus.broadcast(delta, String::new()).await;
        Ok(())
    }
}

#[derive(Clone)]
pub struct NexusGrpc {
    state: AppState,
}

impl NexusGrpc {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

#[tonic::async_trait]
impl NexusService for NexusGrpc {
    async fn register_agent(
        &self,
        request: Request<RegisterAgentRequest>,
    ) -> Result<Response<RegisterAgentResponse>, Status> {
        Ok(Response::new(
            self.state.register_agent_inner(request.into_inner()),
        ))
    }

    type OpenStreamStream = ResponseStream<ServerEvent>;

    async fn open_stream(
        &self,
        request: Request<tonic::Streaming<crate::generated::nexus::v1::ClientEvent>>,
    ) -> Result<Response<Self::OpenStreamStream>, Status> {
        let state = self.state.clone();
        let mut inbound = request.into_inner();
        let output = async_stream::try_stream! {
            while let Some(event) = inbound.message().await? {
                match event.event {
                    Some(crate::generated::nexus::v1::client_event::Event::Heartbeat(heartbeat)) => {
                        state.bus.heartbeat(&heartbeat.agent_id);
                        yield crate::grpc::stream::ack(heartbeat.agent_id, "heartbeat accepted");
                    }
                    Some(crate::generated::nexus::v1::client_event::Event::PublishDelta(request)) |
                    Some(crate::generated::nexus::v1::client_event::Event::Checkpoint(request)) => {
                        let response = state.publish_delta_inner(request).await
                            .map_err(|err| Status::internal(err.to_string()))?;
                        yield ServerEvent {
                            event: Some(server_event::Event::CheckpointCommitted(
                                crate::generated::nexus::v1::CheckpointNotice {
                                    commit_id: response.commit_id,
                                    delta_id: response.delta_id,
                                },
                            )),
                        };
                    }
                    Some(crate::generated::nexus::v1::client_event::Event::Shutdown(reason)) => {
                        yield crate::grpc::stream::ack("shutdown", format!("shutdown requested: {reason}"));
                    }
                    Some(_) => {
                        yield crate::grpc::stream::ack("event", "event accepted");
                    }
                    None => {
                        yield ServerEvent {
                            event: Some(server_event::Event::Error(Error {
                                code: "empty_event".to_string(),
                                message: "client event did not contain an event".to_string(),
                                retryable: false,
                                metadata: None,
                            })),
                        };
                    }
                }
            }
        };
        Ok(Response::new(Box::pin(output) as Self::OpenStreamStream))
    }

    async fn publish_delta(
        &self,
        request: Request<PublishDeltaRequest>,
    ) -> Result<Response<PublishDeltaResponse>, Status> {
        self.state
            .publish_delta_inner(request.into_inner())
            .await
            .map(Response::new)
            .map_err(to_status)
    }

    type SubscribeStream = ResponseStream<BroadcastDelta>;

    async fn subscribe(
        &self,
        request: Request<SubscribeRequest>,
    ) -> Result<Response<Self::SubscribeStream>, Status> {
        let request = request.into_inner();
        let receiver = self.state.bus.subscribe(
            request.subscriber_id,
            request.filter.unwrap_or_else(|| SubscriptionFilter {
                channel_patterns: vec!["*".to_string()],
                durable_only: false,
                tags: Vec::new(),
            }),
            if request.queue_capacity == 0 {
                DEFAULT_SUBSCRIPTION_QUEUE
            } else {
                request.queue_capacity as usize
            },
        );
        let stream = ReceiverStream::new(receiver).map(Ok);
        Ok(Response::new(Box::pin(stream) as Self::SubscribeStream))
    }

    async fn get_channel_snapshot(
        &self,
        request: Request<ChannelSnapshotRequest>,
    ) -> Result<Response<ChannelSnapshotResponse>, Status> {
        Ok(Response::new(
            self.state.bus.snapshot(&request.into_inner().channel),
        ))
    }

    async fn checkpoint(
        &self,
        request: Request<CheckpointRequest>,
    ) -> Result<Response<CheckpointResponse>, Status> {
        self.state
            .checkpoint_inner(request.into_inner())
            .await
            .map(Response::new)
            .map_err(to_status)
    }

    async fn get_commit(
        &self,
        request: Request<GetCommitRequest>,
    ) -> Result<Response<Commit>, Status> {
        self.state
            .get_commit_inner(&request.into_inner().commit_id)
            .map(Response::new)
            .map_err(to_status)
    }

    async fn list_runs(
        &self,
        _request: Request<ListRunsRequest>,
    ) -> Result<Response<ListRunsResponse>, Status> {
        self.state
            .list_runs_inner()
            .map(Response::new)
            .map_err(to_status)
    }

    async fn list_commits(
        &self,
        request: Request<ListCommitsRequest>,
    ) -> Result<Response<ListCommitsResponse>, Status> {
        self.state
            .list_commits_inner(request.into_inner())
            .map(Response::new)
            .map_err(to_status)
    }

    async fn diff_commits(
        &self,
        request: Request<DiffCommitsRequest>,
    ) -> Result<Response<CommitDiff>, Status> {
        self.state
            .diff_inner(request.into_inner())
            .map(Response::new)
            .map_err(to_status)
    }

    async fn replay(
        &self,
        request: Request<ReplayRequest>,
    ) -> Result<Response<ReplayResult>, Status> {
        self.state
            .replay_inner(request.into_inner())
            .map(Response::new)
            .map_err(to_status)
    }

    async fn fork(&self, request: Request<ForkRequest>) -> Result<Response<ForkResult>, Status> {
        self.state
            .fork_inner(request.into_inner())
            .map(Response::new)
            .map_err(to_status)
    }

    async fn rollback(
        &self,
        request: Request<RollbackRequest>,
    ) -> Result<Response<RollbackResponse>, Status> {
        self.state
            .rollback_inner(request.into_inner())
            .map(Response::new)
            .map_err(to_status)
    }

    async fn export_run(
        &self,
        request: Request<ExportRunRequest>,
    ) -> Result<Response<ExportRunResponse>, Status> {
        self.state
            .export_run_inner(request.into_inner())
            .map(Response::new)
            .map_err(to_status)
    }

    async fn health(
        &self,
        _request: Request<HealthRequest>,
    ) -> Result<Response<HealthResponse>, Status> {
        Ok(Response::new(self.state.health()))
    }
}

fn normalize_delta(delta: &mut StateDelta) {
    if delta.delta_id.is_empty() {
        delta.delta_id = new_id("delta");
    }
    if delta.wall_time.is_none() {
        delta.wall_time = Some(now());
    }
    if delta.payload.is_none() {
        delta.payload = Some(empty_json_payload());
    }
    if delta.metadata.is_none() {
        delta.metadata = Some(crate::generated::nexus::v1::Metadata {
            entries: Vec::new(),
        });
    }
}

fn empty_json_payload() -> Payload {
    let data = b"{}".to_vec();
    Payload {
        encoding: PayloadEncoding::Json as i32,
        data: data.clone(),
        struct_data: None,
        size_bytes: data.len() as u64,
        content_hash: blake3_hex(&data),
        compressed: false,
        artifact_ref: String::new(),
    }
}

fn nonempty(value: &str) -> Option<&str> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn to_status(err: anyhow::Error) -> Status {
    let message = err.to_string();
    if message.contains("not found") {
        Status::not_found(message)
    } else if message.contains("permission denied") {
        Status::permission_denied(message)
    } else if message.contains("invalid") {
        Status::invalid_argument(message)
    } else {
        Status::internal(message)
    }
}

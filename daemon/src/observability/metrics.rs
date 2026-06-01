use std::sync::atomic::{AtomicU64, Ordering};

use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use tokio::net::TcpListener;

use crate::grpc::service::AppState;

#[derive(Debug, Default)]
pub struct Counter(AtomicU64);

impl Counter {
    pub fn inc(&self) {
        self.0.fetch_add(1, Ordering::Relaxed);
    }

    pub fn add(&self, value: u64) {
        self.0.fetch_add(value, Ordering::Relaxed);
    }

    pub fn store(&self, value: u64) {
        self.0.store(value, Ordering::Relaxed);
    }

    pub fn load(&self) -> u64 {
        self.0.load(Ordering::Relaxed)
    }
}

#[derive(Debug, Default)]
pub struct Metrics {
    pub agents_connected: Counter,
    pub channels_total: Counter,
    pub subscriptions_total: Counter,
    pub deltas_total: Counter,
    pub ephemeral_deltas_total: Counter,
    pub durable_deltas_total: Counter,
    pub commits_total: Counter,
    pub broadcast_latency_ms: Counter,
    pub store_append_latency_ms: Counter,
    pub grpc_request_latency_ms: Counter,
    pub http_request_latency_ms: Counter,
    pub replay_latency_ms: Counter,
    pub diff_latency_ms: Counter,
    pub loop_warnings_total: Counter,
    pub backpressure_events_total: Counter,
    pub dropped_ephemeral_total: Counter,
    pub artifacts_total: Counter,
    pub errors_total: Counter,
    pub memory_bytes: Counter,
}

#[derive(Debug, Clone, Serialize)]
pub struct MetricsSummary {
    pub nexus_agents_connected: u64,
    pub nexus_channels_total: u64,
    pub nexus_subscriptions_total: u64,
    pub nexus_deltas_total: u64,
    pub nexus_ephemeral_deltas_total: u64,
    pub nexus_durable_deltas_total: u64,
    pub nexus_commits_total: u64,
    pub nexus_loop_warnings_total: u64,
    pub nexus_backpressure_events_total: u64,
    pub nexus_dropped_ephemeral_total: u64,
    pub nexus_artifacts_total: u64,
    pub nexus_errors_total: u64,
    pub nexus_memory_bytes: u64,
}

impl Metrics {
    pub fn summary(&self) -> MetricsSummary {
        MetricsSummary {
            nexus_agents_connected: self.agents_connected.load(),
            nexus_channels_total: self.channels_total.load(),
            nexus_subscriptions_total: self.subscriptions_total.load(),
            nexus_deltas_total: self.deltas_total.load(),
            nexus_ephemeral_deltas_total: self.ephemeral_deltas_total.load(),
            nexus_durable_deltas_total: self.durable_deltas_total.load(),
            nexus_commits_total: self.commits_total.load(),
            nexus_loop_warnings_total: self.loop_warnings_total.load(),
            nexus_backpressure_events_total: self.backpressure_events_total.load(),
            nexus_dropped_ephemeral_total: self.dropped_ephemeral_total.load(),
            nexus_artifacts_total: self.artifacts_total.load(),
            nexus_errors_total: self.errors_total.load(),
            nexus_memory_bytes: self.memory_bytes.load(),
        }
    }

    pub fn prometheus(&self) -> String {
        let summary = self.summary();
        [
            ("nexus_agents_connected", summary.nexus_agents_connected),
            ("nexus_channels_total", summary.nexus_channels_total),
            (
                "nexus_subscriptions_total",
                summary.nexus_subscriptions_total,
            ),
            ("nexus_deltas_total", summary.nexus_deltas_total),
            (
                "nexus_ephemeral_deltas_total",
                summary.nexus_ephemeral_deltas_total,
            ),
            (
                "nexus_durable_deltas_total",
                summary.nexus_durable_deltas_total,
            ),
            ("nexus_commits_total", summary.nexus_commits_total),
            (
                "nexus_loop_warnings_total",
                summary.nexus_loop_warnings_total,
            ),
            (
                "nexus_backpressure_events_total",
                summary.nexus_backpressure_events_total,
            ),
            (
                "nexus_dropped_ephemeral_total",
                summary.nexus_dropped_ephemeral_total,
            ),
            ("nexus_artifacts_total", summary.nexus_artifacts_total),
            ("nexus_errors_total", summary.nexus_errors_total),
            ("nexus_memory_bytes", summary.nexus_memory_bytes),
        ]
        .iter()
        .map(|(name, value)| format!("# TYPE {name} gauge\n{name} {value}\n"))
        .collect()
    }
}

pub async fn serve(listener: TcpListener, state: AppState) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/metrics", get(metrics))
        .route("/api/metrics-summary", get(summary))
        .with_state(state);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn metrics(State(state): State<AppState>) -> impl IntoResponse {
    state.metrics.prometheus()
}

async fn summary(State(state): State<AppState>) -> Json<MetricsSummary> {
    Json(state.metrics.summary())
}

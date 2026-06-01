#![allow(dead_code)]

pub mod auth;
pub mod bus;
pub mod cluster;
pub mod config;
pub mod error;
pub mod generated;
pub mod grpc;
pub mod http;
pub mod ipc;
pub mod ledger;
pub mod loop_detection;
pub mod mcp;
pub mod observability;
pub mod security;
pub mod shutdown;
pub mod util;

use std::sync::Arc;

use anyhow::Context;
use tokio::net::TcpListener;
use tokio::task::JoinSet;
use tracing::info;

use crate::bus::Bus;
use crate::config::Config;
use crate::grpc::service::AppState;
use crate::ledger::dag::DagIndex;
use crate::ledger::sqlite_store::SqliteStore;
use crate::ledger::store::Store;
use crate::observability::metrics::Metrics;

pub async fn run_from_env() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    run(config).await
}

pub async fn run(config: Config) -> anyhow::Result<()> {
    observability::tracing_setup::init(config.otel_enabled);
    config.prepare()?;
    config.validate_network_policy()?;

    let store = Arc::new(SqliteStore::open(&config).context("open SQLite store")?);
    let commits = store.list_all_commits().context("load commits")?;
    let dag = Arc::new(DagIndex::from_commits(&commits).context("rebuild DAG index")?);
    let metrics = Arc::new(Metrics::default());
    let bus = Arc::new(Bus::new(metrics.clone()));
    let state = AppState::new(config.clone(), bus, store, dag, metrics);

    info!(
        grpc_addr = %config.grpc_addr,
        http_addr = %config.http_addr,
        metrics_addr = %config.metrics_addr,
        bind_mode = %config.bind_mode,
        "starting Nexus daemon"
    );
    println!(
        "Nexus daemon listening locally: gRPC {}, HTTP {}, metrics {}",
        config.grpc_addr, config.http_addr, config.metrics_addr
    );

    let grpc_listener = TcpListener::bind(config.grpc_addr).await?;
    let http_listener = TcpListener::bind(config.http_addr).await?;
    let metrics_listener = TcpListener::bind(config.metrics_addr).await?;

    let mut tasks = JoinSet::new();
    tasks.spawn(grpc::server::serve(grpc_listener, state.clone()));
    tasks.spawn(http::api::serve(http_listener, state.clone()));
    tasks.spawn(observability::metrics::serve(
        metrics_listener,
        state.clone(),
    ));

    tokio::select! {
        _ = shutdown::shutdown_signal() => {
            info!("shutdown signal received");
        }
        result = tasks.join_next() => {
            if let Some(result) = result {
                result??;
            }
        }
    }

    Ok(())
}

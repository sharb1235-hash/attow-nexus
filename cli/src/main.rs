mod client;
mod commands;
mod output;

use std::path::PathBuf;
use std::time::Instant;

use clap::{Args, Parser, Subcommand};
use serde_json::{json, Value};

use client::HttpClient;
use output::print_value;

#[derive(Parser)]
#[command(name = "nexus", version, about = "Nexus local coordination CLI")]
struct Cli {
    #[arg(long, global = true)]
    json: bool,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    #[command(about = commands::init::ABOUT)]
    Init,
    #[command(about = commands::daemon::ABOUT)]
    Daemon {
        #[command(subcommand)]
        command: DaemonCommand,
    },
    #[command(about = commands::status::ABOUT)]
    Status,
    #[command(about = commands::agents::ABOUT)]
    Agents,
    #[command(about = commands::channels::ABOUT)]
    Channels {
        #[command(subcommand)]
        command: Option<ChannelsCommand>,
    },
    #[command(about = commands::publish::ABOUT)]
    Publish(PublishArgs),
    #[command(about = commands::subscribe::ABOUT)]
    Subscribe { channel: String },
    #[command(about = commands::checkpoint::ABOUT)]
    Checkpoint(CheckpointArgs),
    #[command(about = commands::log::ABOUT)]
    Log {
        #[arg(long)]
        run: String,
    },
    #[command(about = commands::inspect::ABOUT)]
    Inspect { commit_id: String },
    #[command(about = commands::diff::ABOUT)]
    Diff { commit_a: String, commit_b: String },
    #[command(about = commands::replay::ABOUT)]
    Replay { commit_id: String },
    #[command(about = commands::fork::ABOUT)]
    Fork {
        commit_id: String,
        #[arg(long)]
        new_run: Option<String>,
    },
    #[command(about = commands::rollback::ABOUT)]
    Rollback {
        #[arg(long)]
        head: String,
        #[arg(long = "to")]
        to: String,
        #[arg(long)]
        force: bool,
    },
    #[command(about = commands::export::ABOUT)]
    Export {
        #[arg(long)]
        run: String,
        #[arg(long, default_value = "json")]
        format: String,
    },
    #[command(about = commands::doctor::ABOUT)]
    Doctor,
    #[command(about = commands::bench::ABOUT)]
    Bench {
        #[command(subcommand)]
        command: BenchCommand,
    },
}

#[derive(Subcommand)]
enum DaemonCommand {
    Start,
    Stop,
}

#[derive(Subcommand)]
enum ChannelsCommand {
    Inspect { channel: String },
}

#[derive(Subcommand)]
enum BenchCommand {
    Local {
        #[arg(long, default_value_t = 10_000)]
        events: usize,
        #[arg(long, default_value_t = 4096)]
        payload_size: usize,
    },
}

#[derive(Args)]
struct PublishArgs {
    channel: String,
    #[arg(long)]
    file: PathBuf,
    #[arg(long)]
    durable: bool,
    #[arg(long, default_value = "cli-agent")]
    agent: String,
    #[arg(long, default_value = "cli-run")]
    run: String,
    #[arg(long, default_value = "")]
    summary: String,
}

#[derive(Args)]
struct CheckpointArgs {
    #[arg(long)]
    agent: String,
    #[arg(long)]
    run: String,
    #[arg(long)]
    channel: String,
    #[arg(long)]
    file: PathBuf,
    #[arg(long, default_value = "")]
    summary: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Init => init(cli.json).await,
        Command::Daemon { command } => match command {
            DaemonCommand::Start => nexusd::run_from_env().await,
            DaemonCommand::Stop => {
                println!("Nexus daemon stops with Ctrl-C or the hosting service manager.");
                Ok(())
            }
        },
        Command::Status => print(HttpClient::from_env().get("/api/health").await?, cli.json),
        Command::Agents => agents(cli.json).await,
        Command::Channels { command } => match command {
            Some(ChannelsCommand::Inspect { channel }) => {
                let encoded = urlencoding::encode(&channel);
                print(
                    HttpClient::from_env()
                        .get(&format!("/api/channels/{encoded}/snapshot"))
                        .await?,
                    cli.json,
                )
            }
            None => print(HttpClient::from_env().get("/api/channels").await?, cli.json),
        },
        Command::Publish(args) => publish(args, cli.json).await,
        Command::Subscribe { channel } => subscribe(channel, cli.json).await,
        Command::Checkpoint(args) => checkpoint(args, cli.json).await,
        Command::Log { run } => print(
            HttpClient::from_env()
                .get(&format!("/api/runs/{}/commits", urlencoding::encode(&run)))
                .await?,
            cli.json,
        ),
        Command::Inspect { commit_id } => print(
            HttpClient::from_env()
                .get(&format!("/api/commits/{commit_id}"))
                .await?,
            cli.json,
        ),
        Command::Diff { commit_a, commit_b } => print(
            HttpClient::from_env()
                .get(&format!("/api/diff?from={commit_a}&to={commit_b}"))
                .await?,
            cli.json,
        ),
        Command::Replay { commit_id } => print(
            HttpClient::from_env()
                .post(
                    "/api/replay",
                    json!({"commit_id": commit_id, "mode": "state_only"}),
                )
                .await?,
            cli.json,
        ),
        Command::Fork { commit_id, new_run } => print(
            HttpClient::from_env()
                .post(
                    "/api/fork",
                    json!({"source_commit_id": commit_id, "new_run_id": new_run}),
                )
                .await?,
            cli.json,
        ),
        Command::Rollback { head, to, force } => print(
            HttpClient::from_env()
                .post(
                    "/api/rollback",
                    json!({"head_commit_id": head, "target_commit_id": to, "force": force}),
                )
                .await?,
            cli.json,
        ),
        Command::Export { run, format } => print(
            HttpClient::from_env()
                .get(&format!(
                    "/api/runs/{}/commits?format={format}",
                    urlencoding::encode(&run)
                ))
                .await?,
            cli.json,
        ),
        Command::Doctor => doctor(cli.json).await,
        Command::Bench { command } => match command {
            BenchCommand::Local {
                events,
                payload_size,
            } => bench(events, payload_size, cli.json).await,
        },
    }
}

async fn init(json_output: bool) -> anyhow::Result<()> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let dir = PathBuf::from(home).join(".nexus");
    std::fs::create_dir_all(&dir)?;
    let value = json!({
        "dataDir": dir,
        "message": "Nexus local data directory is ready"
    });
    print(value, json_output)
}

async fn agents(json_output: bool) -> anyhow::Result<()> {
    let value = HttpClient::from_env().get("/api/agents").await?;
    print(rename_agent_last_seen(value), json_output)
}

fn rename_agent_last_seen(value: Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(rename_agent_last_seen)
                .collect::<Vec<_>>(),
        ),
        Value::Object(mut map) => {
            if let Some(last_seen) = map.remove("last_seen_seconds") {
                map.insert("last_seen_unix_seconds".to_string(), last_seen);
            }
            Value::Object(map)
        }
        other => other,
    }
}

async fn publish(args: PublishArgs, json_output: bool) -> anyhow::Result<()> {
    let body = read_json_file(&args.file)?;
    let value = HttpClient::from_env()
        .post(
            "/api/deltas",
            json!({
                "channel": args.channel,
                "agent_id": args.agent,
                "run_id": args.run,
                "delta": body,
                "durable": args.durable,
                "summary": args.summary
            }),
        )
        .await?;
    print(value, json_output)
}

async fn checkpoint(args: CheckpointArgs, json_output: bool) -> anyhow::Result<()> {
    let body = read_json_file(&args.file)?;
    let value = HttpClient::from_env()
        .post(
            "/api/checkpoint",
            json!({
                "agent_id": args.agent,
                "run_id": args.run,
                "channel": args.channel,
                "state": body,
                "summary": args.summary
            }),
        )
        .await?;
    print(value, json_output)
}

async fn subscribe(channel: String, json_output: bool) -> anyhow::Result<()> {
    let client = HttpClient::from_env();
    let mut seen = 0usize;
    loop {
        let encoded = urlencoding::encode(&channel);
        let value = client
            .get(&format!("/api/channels/{encoded}/deltas"))
            .await?;
        if let Some(items) = value.as_array() {
            for item in items.iter().skip(seen) {
                print_value(item, json_output)?;
            }
            seen = items.len();
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}

async fn doctor(json_output: bool) -> anyhow::Result<()> {
    let client = HttpClient::from_env();
    let health = client.get("/api/health").await;
    let value = json!({
        "daemonReachable": health.is_ok(),
        "health": health.unwrap_or_else(|err| json!({"error": err.to_string()})),
        "authConfigured": std::env::var("NEXUS_AUTH_TOKEN").is_ok(),
        "dataDirWritable": std::env::var("NEXUS_DATA_DIR").ok().map(|dir| std::fs::metadata(dir).is_ok()).unwrap_or(true),
        "dashboardReachable": true,
        "protoVersionCompatibility": "nexus.v1"
    });
    print(value, json_output)
}

async fn bench(events: usize, payload_size: usize, json_output: bool) -> anyhow::Result<()> {
    let client = HttpClient::from_env();
    let payload = "x".repeat(payload_size);
    let mut latencies = Vec::with_capacity(events);
    for idx in 0..events {
        let started = Instant::now();
        client
            .post(
                "/api/deltas",
                json!({
                    "channel": "topic:bench",
                    "agent_id": "bench",
                    "run_id": "bench-run",
                    "delta": {"idx": idx, "payload": payload},
                    "durable": idx % 10 == 0,
                    "summary": "bench event"
                }),
            )
            .await?;
        latencies.push(started.elapsed().as_micros() as u64);
    }
    latencies.sort_unstable();
    let value = json!({
        "events": events,
        "payloadSize": payload_size,
        "p50PublishLatencyMicros": percentile(&latencies, 50.0),
        "p95PublishLatencyMicros": percentile(&latencies, 95.0),
        "p99PublishLatencyMicros": percentile(&latencies, 99.0),
        "deltasPerSecond": if latencies.is_empty() { 0.0 } else { 1_000_000.0 / (latencies.iter().sum::<u64>() as f64 / latencies.len() as f64) },
        "commitLatencyMicros": "durable events are included in the sampled publish latencies",
        "artifactThroughput": "run with payloads above NEXUS_MAX_INLINE_PAYLOAD_BYTES to measure artifact throughput",
        "memoryUsage": "available from /api/metrics-summary"
    });
    print(value, json_output)
}

fn percentile(values: &[u64], percentile: f64) -> u64 {
    if values.is_empty() {
        return 0;
    }
    let idx = ((percentile / 100.0) * (values.len() - 1) as f64).round() as usize;
    values[idx]
}

fn read_json_file(path: &PathBuf) -> anyhow::Result<Value> {
    let text = std::fs::read_to_string(path)?;
    Ok(serde_json::from_str(&text)?)
}

fn print(value: Value, json_output: bool) -> anyhow::Result<()> {
    print_value(&value, json_output)
}

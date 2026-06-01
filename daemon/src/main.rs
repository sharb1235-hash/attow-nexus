#[tokio::main]
async fn main() -> anyhow::Result<()> {
    nexusd::run_from_env().await
}

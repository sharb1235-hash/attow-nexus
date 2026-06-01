use std::net::SocketAddr;

pub fn validate_loopback(addr: SocketAddr, allow_remote: bool) -> anyhow::Result<()> {
    if !allow_remote && !addr.ip().is_loopback() {
        anyhow::bail!("TCP bind must be loopback unless remote binding is explicitly allowed");
    }
    Ok(())
}

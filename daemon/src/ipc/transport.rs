use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub enum LocalTransport {
    UnixDomainSocket(String),
    WindowsNamedPipe(String),
    Tcp(SocketAddr),
}

impl LocalTransport {
    pub fn description(&self) -> String {
        match self {
            Self::UnixDomainSocket(path) => format!("uds:{path}"),
            Self::WindowsNamedPipe(name) => format!("pipe:{name}"),
            Self::Tcp(addr) => format!("tcp:{addr}"),
        }
    }
}

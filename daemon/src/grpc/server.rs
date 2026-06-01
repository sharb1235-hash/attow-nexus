use tokio::net::TcpListener;
use tokio_stream::wrappers::TcpListenerStream;
use tonic::transport::Server;

use crate::generated::nexus::v1::nexus_service_server::NexusServiceServer;
use crate::grpc::interceptors::AuthInterceptor;
use crate::grpc::service::{AppState, NexusGrpc};

pub async fn serve(listener: TcpListener, state: AppState) -> anyhow::Result<()> {
    let interceptor = AuthInterceptor::new(state.config.clone());
    let service = NexusServiceServer::with_interceptor(NexusGrpc::new(state), interceptor);
    Server::builder()
        .add_service(service)
        .serve_with_incoming(TcpListenerStream::new(listener))
        .await?;
    Ok(())
}

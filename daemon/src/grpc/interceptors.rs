use tonic::{Request, Status};

use crate::auth::token;
use crate::config::Config;

#[derive(Clone)]
pub struct AuthInterceptor {
    config: Config,
}

impl AuthInterceptor {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl tonic::service::Interceptor for AuthInterceptor {
    fn call(&mut self, request: Request<()>) -> Result<Request<()>, Status> {
        token::validate_grpc(request, &self.config)
    }
}

use axum::http::HeaderMap;
use tonic::{Request, Status};

use crate::config::Config;

pub fn validate_http(headers: &HeaderMap, config: &Config) -> Result<(), axum::http::StatusCode> {
    if !config.require_auth {
        return Ok(());
    }
    let Some(expected) = config.auth_token.as_deref() else {
        return Err(axum::http::StatusCode::UNAUTHORIZED);
    };
    let Some(actual) = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
    else {
        return Err(axum::http::StatusCode::UNAUTHORIZED);
    };
    if constant_time_eq(actual.as_bytes(), expected.as_bytes()) {
        Ok(())
    } else {
        Err(axum::http::StatusCode::FORBIDDEN)
    }
}

#[allow(clippy::result_large_err)]
pub fn validate_grpc<T>(request: Request<T>, config: &Config) -> Result<Request<T>, Status> {
    if !config.require_auth {
        return Ok(request);
    }
    let Some(expected) = config.auth_token.as_deref() else {
        return Err(Status::unauthenticated("auth token required"));
    };
    let Some(actual) = request
        .metadata()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
    else {
        return Err(Status::unauthenticated("bearer token required"));
    };
    if constant_time_eq(actual.as_bytes(), expected.as_bytes()) {
        Ok(request)
    } else {
        Err(Status::permission_denied("invalid bearer token"))
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter()
        .zip(b.iter())
        .fold(0u8, |acc, (left, right)| acc | (left ^ right))
        == 0
}

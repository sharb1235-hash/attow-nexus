use reqwest::Method;
use serde_json::Value;

#[derive(Clone)]
pub struct HttpClient {
    base_url: String,
    token: Option<String>,
    inner: reqwest::Client,
}

impl HttpClient {
    pub fn from_env() -> Self {
        Self {
            base_url: std::env::var("NEXUS_HTTP_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:7822".to_string()),
            token: std::env::var("NEXUS_AUTH_TOKEN")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            inner: reqwest::Client::new(),
        }
    }

    pub async fn get(&self, path: &str) -> anyhow::Result<Value> {
        self.request(Method::GET, path, None).await
    }

    pub async fn post(&self, path: &str, body: Value) -> anyhow::Result<Value> {
        self.request(Method::POST, path, Some(body)).await
    }

    async fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> anyhow::Result<Value> {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        let mut request = self.inner.request(method, url);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request.send().await?;
        let status = response.status();
        let text = response.text().await?;
        if !status.is_success() {
            anyhow::bail!("daemon returned {status}: {text}");
        }
        if text.trim().is_empty() {
            Ok(Value::Null)
        } else {
            Ok(serde_json::from_str(&text)?)
        }
    }
}

use std::time::Duration;
use reqwest::Client;

#[derive(Debug, thiserror::Error)]
pub enum AiError {
    #[error("Missing API Key. Please configure your Groq API key in Settings.")]
    MissingApiKey,
    #[error("Audio input too short (<300ms) or silent.")]
    AudioTooShort,
    #[error("Empty audio buffer")]
    EmptyAudio,
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("API error (Status {status}): {message}")]
    Api { status: u16, message: String },
    #[error("Failed to parse API response: {0}")]
    ParseError(String),
    #[error("AI service timeout after {0}s")]
    Timeout(u64),
}

#[derive(Clone)]
pub struct AiHttpClient {
    pub client: Client,
    pub timeout: Duration,
}

impl AiHttpClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(5)
            .tcp_keepalive(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            timeout: Duration::from_secs(8),
        }
    }

    pub fn with_timeout(timeout: Duration) -> Self {
        let mut s = Self::new();
        s.timeout = timeout;
        s
    }
}

impl Default for AiHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

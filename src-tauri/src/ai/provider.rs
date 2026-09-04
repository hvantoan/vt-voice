use super::client::{AiError, AiHttpClient};
use super::groq;
use super::openrouter;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AiProvider {
    Groq,
    OpenRouter,
    Custom(Option<String>),
}

impl AiProvider {
    pub fn from_str(provider: &str, custom_endpoint: Option<String>) -> Self {
        match provider.trim().to_lowercase().as_str() {
            "openrouter" => AiProvider::OpenRouter,
            "custom" => AiProvider::Custom(custom_endpoint),
            _ => AiProvider::Groq,
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            AiProvider::Groq => "groq",
            AiProvider::OpenRouter => "openrouter",
            AiProvider::Custom(_) => "custom",
        }
    }
}

/// Unified STT transcription dispatcher across Groq, OpenRouter, and Custom OpenAI endpoints
pub async fn transcribe_with_provider(
    provider: &str,
    http: &AiHttpClient,
    api_key: &str,
    model: &str,
    wav_bytes: Vec<u8>,
    custom_vocab: &[String],
    custom_endpoint: Option<&str>,
) -> Result<String, AiError> {
    match provider.trim().to_lowercase().as_str() {
        "openrouter" => {
            openrouter::transcribe_openrouter(http, api_key, model, wav_bytes, custom_vocab, None).await
        }
        "custom" => {
            openrouter::transcribe_openrouter(http, api_key, model, wav_bytes, custom_vocab, custom_endpoint).await
        }
        _ => {
            groq::transcribe(http, api_key, wav_bytes, custom_vocab).await
        }
    }
}

/// Unified connection latency tester across Groq, OpenRouter, and Custom endpoints
pub async fn test_provider_connection(
    provider: &str,
    http: &AiHttpClient,
    api_key: &str,
    custom_endpoint: Option<&str>,
) -> Result<u64, AiError> {
    match provider.trim().to_lowercase().as_str() {
        "openrouter" => {
            openrouter::test_openrouter_connection(http, api_key, None).await
        }
        "custom" => {
            openrouter::test_openrouter_connection(http, api_key, custom_endpoint).await
        }
        _ => {
            groq::test_connection(http, api_key).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_provider_from_str() {
        assert_eq!(AiProvider::from_str("groq", None), AiProvider::Groq);
        assert_eq!(AiProvider::from_str("GROQ", None), AiProvider::Groq);
        assert_eq!(AiProvider::from_str("openrouter", None), AiProvider::OpenRouter);
        assert_eq!(AiProvider::from_str("OpenRouter", None), AiProvider::OpenRouter);
        assert_eq!(
            AiProvider::from_str("custom", Some("http://localhost:8000".into())),
            AiProvider::Custom(Some("http://localhost:8000".into()))
        );
    }
}

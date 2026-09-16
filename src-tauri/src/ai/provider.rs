use std::time::Duration;
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

/// Universal endpoint latency tester measuring ping to {base_url}/models
pub async fn test_endpoint_latency(
    http: &AiHttpClient,
    base_url: &str,
    api_key: Option<&str>,
) -> Result<u64, AiError> {
    let clean_base = base_url.trim().trim_end_matches('/');
    let clean_base = clean_base.strip_suffix("/audio/transcriptions").unwrap_or(clean_base);
    let url = if clean_base.ends_with("/models") {
        clean_base.to_string()
    } else {
        format!("{}/models", clean_base)
    };
    let start = std::time::Instant::now();

    let mut req = http
        .client
        .get(&url)
        .timeout(Duration::from_secs(5));

    if clean_base.contains("openrouter.ai") {
        req = req
            .header("HTTP-Referer", openrouter::OPENROUTER_REFERER)
            .header("X-Title", openrouter::OPENROUTER_TITLE);
    }

    if let Some(key) = api_key.filter(|k| !k.trim().is_empty()) {
        req = req.bearer_auth(key.trim());
    }

    let res = req.send().await.map_err(|e| {
        if e.is_timeout() {
            AiError::Timeout(5)
        } else {
            AiError::Network(e)
        }
    })?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        let sanitized = openrouter::sanitize_error_message(&body, api_key.unwrap_or_default());
        return Err(AiError::Api { status, message: sanitized });
    }

    Ok(start.elapsed().as_millis() as u64)
}

/// Unified STT transcription dispatcher targeting an arbitrary OpenAI-compatible base URL
pub async fn transcribe_with_endpoint(
    http: &AiHttpClient,
    base_url: &str,
    api_key: &str,
    model: &str,
    wav_bytes: Vec<u8>,
    custom_vocab: &[String],
) -> Result<String, AiError> {
    if wav_bytes.len() < 44 + 4800 {
        return Err(AiError::AudioTooShort);
    }
    openrouter::transcribe_openrouter(http, api_key, model, wav_bytes, custom_vocab, Some(base_url)).await
}

/// Unified chat completion polisher targeting an arbitrary OpenAI-compatible base URL with system prompt
pub async fn polish_with_endpoint(
    http: &AiHttpClient,
    base_url: &str,
    api_key: &str,
    model: &str,
    raw_text: &str,
    system_prompt: Option<&str>,
) -> Result<String, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }
    let trimmed = raw_text.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    let sys_prompt = system_prompt
        .filter(|p| !p.trim().is_empty())
        .unwrap_or(super::prompts::DEFAULT_POLISH_SYSTEM_PROMPT);

    let clean_base = base_url.trim().trim_end_matches('/');
    let clean_base = clean_base.strip_suffix("/audio/transcriptions").unwrap_or(clean_base);
    let url = if clean_base.ends_with("/chat/completions") {
        clean_base.to_string()
    } else {
        format!("{}/chat/completions", clean_base)
    };

    let model_name = if model.trim().is_empty() {
        "llama-3.3-70b-versatile"
    } else {
        model.trim()
    };

    let request_body = serde_json::json!({
        "model": model_name,
        "messages": [
            { "role": "system", "content": sys_prompt },
            { "role": "user", "content": trimmed }
        ],
        "temperature": 0.1,
        "max_tokens": 512,
    });

    let mut req = http
        .client
        .post(&url)
        .bearer_auth(key)
        .timeout(http.timeout)
        .json(&request_body);

    if clean_base.contains("openrouter.ai") {
        req = req
            .header("HTTP-Referer", openrouter::OPENROUTER_REFERER)
            .header("X-Title", openrouter::OPENROUTER_TITLE);
    }

    let res = req.send().await?;
    let status = res.status().as_u16();
    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        let sanitized = openrouter::sanitize_error_message(&err_body, key);
        return Err(AiError::Api {
            status,
            message: sanitized,
        });
    }

    #[derive(serde::Deserialize)]
    struct PolishChatMessage {
        #[serde(default)]
        content: Option<String>,
    }

    #[derive(serde::Deserialize)]
    struct PolishChatChoice {
        message: PolishChatMessage,
    }

    #[derive(serde::Deserialize)]
    struct PolishChatResponse {
        choices: Vec<PolishChatChoice>,
    }

    let data: PolishChatResponse = res
        .json()
        .await
        .map_err(|e| AiError::ParseError(format!("Failed to parse Chat JSON: {}", e)))?;

    if let Some(first_choice) = data.choices.into_iter().next() {
        let output = first_choice.message.content.unwrap_or_default().trim().to_string();

        // Anti-hallucination guard: If LLM output is empty or > 3x original length, fallback
        if output.is_empty() || output.len() > (trimmed.len() * 3) {
            Ok(super::fallback::LocalPolisher::polish(trimmed))
        } else {
            Ok(output)
        }
    } else {
        Ok(super::fallback::LocalPolisher::polish(trimmed))
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
    let lower = provider.trim().to_lowercase();
    match lower.as_str() {
        "openrouter" => {
            openrouter::transcribe_openrouter(http, api_key, model, wav_bytes, custom_vocab, None).await
        }
        "custom" => {
            openrouter::transcribe_openrouter(http, api_key, model, wav_bytes, custom_vocab, custom_endpoint).await
        }
        "groq" => {
            groq::transcribe(http, api_key, wav_bytes, custom_vocab).await
        }
        _ => {
            if let Some(prov) = crate::storage::get_provider(provider) {
                transcribe_with_endpoint(http, &prov.base_url, api_key, model, wav_bytes, custom_vocab).await
            } else if let Some(endpoint) = custom_endpoint {
                transcribe_with_endpoint(http, endpoint, api_key, model, wav_bytes, custom_vocab).await
            } else {
                groq::transcribe(http, api_key, wav_bytes, custom_vocab).await
            }
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
            test_endpoint_latency(http, "https://openrouter.ai/api/v1", Some(api_key)).await
        }
        "custom" => {
            let ep = custom_endpoint.unwrap_or("http://localhost:8000/v1");
            test_endpoint_latency(http, ep, Some(api_key)).await
        }
        "groq" => {
            test_endpoint_latency(http, "https://api.groq.com/openai/v1", Some(api_key)).await
        }
        _ => {
            if let Some(prov) = crate::storage::get_provider(provider) {
                test_endpoint_latency(http, &prov.base_url, Some(api_key)).await
            } else {
                test_endpoint_latency(http, "https://api.groq.com/openai/v1", Some(api_key)).await
            }
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

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

/// Categorizes an AiError into a short sanitized kind string for zero-PII logging.
/// Never logs the underlying message, which may embed user text or API key fragments.
pub fn error_kind(e: &AiError) -> &'static str {
    match e {
        AiError::MissingApiKey => "missing_api_key",
        AiError::AudioTooShort => "audio_too_short",
        AiError::EmptyAudio => "empty_audio",
        AiError::Timeout(_) => "timeout",
        AiError::Network(_) => "network",
        AiError::Api { status, .. } => error_kind_status(*status),
        AiError::ParseError(_) => "parse_error",
    }
}

/// HTTP status → sanitized kind. `_` keeps the match total for any status.
pub fn error_kind_status(status: u16) -> &'static str {
    match status {
        400 => "bad_request",
        401 => "unauthorized",
        403 => "forbidden",
        404 => "not_found",
        408 => "request_timeout",
        429 => "rate_limit",
        500..=599 => "server_error",
        _ => "api_error",
    }
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

/// Prepares a base URL for logging: rebuilds `scheme://host[:port]/path`,
/// dropping query, fragment, and userinfo (`user:pass@`). Input that does not
/// parse as an absolute URL is replaced by a marker — never echoed back.
pub fn sanitize_base_url_for_log(base_url: &str) -> String {
    let Ok(u) = reqwest::Url::parse(base_url.trim()) else {
        return "<invalid-url>".to_string();
    };
    let mut out = format!("{}://{}", u.scheme(), u.host_str().unwrap_or(""));
    if let Some(port) = u.port() {
        out.push_str(&format!(":{}", port));
    }
    out.push_str(u.path());
    out
}

/// Strips trailing slashes and common API endpoint suffixes (`/models`, `/audio/transcriptions`, `/chat/completions`)
/// returning the normalized base URL.
pub fn normalize_base_url(base_url: &str) -> String {
    const SUFFIXES: &[&str] = &[
        "/audio/transcriptions",
        "/chat/completions",
        "/models",
    ];

    let mut clean = base_url.trim().trim_end_matches('/');
    loop {
        let next = SUFFIXES
            .iter()
            .find_map(|suffix| clean.strip_suffix(suffix))
            .map(|s| s.trim_end_matches('/'))
            .unwrap_or(clean);

        if next == clean {
            break;
        }
        clean = next;
    }
    clean.to_string()
}

/// Universal endpoint latency tester measuring ping to {base_url}/models
pub async fn test_endpoint_latency(
    http: &AiHttpClient,
    base_url: &str,
    api_key: Option<&str>,
) -> Result<u64, AiError> {
    let clean_base = normalize_base_url(base_url);
    let url = format!("{}/models", clean_base);
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
    let started = std::time::Instant::now();
    let audio_size_bytes = wav_bytes.len();
    log::info!(
        target: "vt_voice::ai::stt",
        "STT request started: base_url={}, model={}, audio_size_bytes={}",
        sanitize_base_url_for_log(base_url),
        model,
        audio_size_bytes
    );
    if audio_size_bytes < 44 + 4800 {
        log::warn!(
            target: "vt_voice::ai::stt",
            "STT rejected: base_url={}, model={}, audio_size_bytes={}, error_kind={}",
            sanitize_base_url_for_log(base_url),
            model,
            audio_size_bytes,
            error_kind(&AiError::AudioTooShort)
        );
        return Err(AiError::AudioTooShort);
    }
    let result = openrouter::transcribe_openrouter(http, api_key, model, wav_bytes, custom_vocab, Some(base_url)).await;
    let duration_ms = started.elapsed().as_millis() as u64;
    match &result {
        Ok(text) => log::info!(
            target: "vt_voice::ai::stt",
            "STT completed: base_url={}, model={}, duration_ms={}, text_len={}",
            sanitize_base_url_for_log(base_url),
            model,
            duration_ms,
            text.len()
        ),
        Err(e) => log::error!(
            target: "vt_voice::ai::stt",
            "STT failed: base_url={}, model={}, duration_ms={}, error_kind={}",
            sanitize_base_url_for_log(base_url),
            model,
            duration_ms,
            error_kind(e)
        ),
    }
    result
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

    let clean_base = normalize_base_url(base_url);
    let url = format!("{}/chat/completions", clean_base);
    let started = std::time::Instant::now();
    let model_name = if model.trim().is_empty() {
        "llama-3.3-70b-versatile"
    } else {
        model.trim()
    };
    log::info!(
        target: "vt_voice::ai::polish",
        "Polish request started: base_url={}, model={}, input_len={}",
        sanitize_base_url_for_log(base_url),
        model_name,
        trimmed.len()
    );

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
        log::warn!(
            target: "vt_voice::ai::polish",
            "Polish failed: base_url={}, model={}, duration_ms={}, error_kind={}",
            sanitize_base_url_for_log(base_url),
            model_name,
            started.elapsed().as_millis() as u64,
            error_kind_status(status)
        );
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
            log::warn!(
                target: "vt_voice::ai::polish",
                "Polish output rejected by guard, using local fallback: base_url={}, model={}, duration_ms={}, output_len={}",
                sanitize_base_url_for_log(base_url),
                model_name,
                started.elapsed().as_millis() as u64,
                output.len()
            );
            Ok(super::fallback::LocalPolisher::polish(trimmed))
        } else {
            log::info!(
                target: "vt_voice::ai::polish",
                "Polish completed: base_url={}, model={}, duration_ms={}, output_len={}",
                sanitize_base_url_for_log(base_url),
                model_name,
                started.elapsed().as_millis() as u64,
                output.len()
            );
            Ok(output)
        }
    } else {
        log::warn!(
            target: "vt_voice::ai::polish",
            "Polish returned no choices, using local fallback: base_url={}, model={}, duration_ms={}",
            sanitize_base_url_for_log(base_url),
            model_name,
            started.elapsed().as_millis() as u64
        );
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

    #[test]
    fn test_normalize_base_url() {
        assert_eq!(
            normalize_base_url("https://api.openai.com/v1/models"),
            "https://api.openai.com/v1"
        );
        assert_eq!(
            normalize_base_url("https://api.openai.com/v1/models/"),
            "https://api.openai.com/v1"
        );
        assert_eq!(
            normalize_base_url("https://api.openai.com/v1/audio/transcriptions"),
            "https://api.openai.com/v1"
        );
        assert_eq!(
            normalize_base_url("https://api.openai.com/v1/chat/completions/"),
            "https://api.openai.com/v1"
        );
        assert_eq!(
            normalize_base_url("  https://api.groq.com/openai/v1/  "),
            "https://api.groq.com/openai/v1"
        );
        assert_eq!(
            normalize_base_url("https://api.groq.com/openai/v1"),
            "https://api.groq.com/openai/v1"
        );
    }

    #[test]
    fn test_sanitize_base_url_for_log_strips_secrets() {
        // Query params and fragments may carry tokens — never log them.
        assert_eq!(
            sanitize_base_url_for_log("https://api.example.com/v1?api_key=sk-secret&x=1"),
            "https://api.example.com/v1"
        );
        assert_eq!(
            sanitize_base_url_for_log("https://api.example.com/v1#token=abc"),
            "https://api.example.com/v1"
        );
        // Userinfo (user:pass@) must be dropped, scheme+host kept.
        assert_eq!(
            sanitize_base_url_for_log("https://user:secret@api.example.com/v1"),
            "https://api.example.com/v1"
        );
        // Uppercase scheme is normalized, not truncated.
        assert_eq!(
            sanitize_base_url_for_log("HTTPS://user:secret@api.example.com/v1"),
            "https://api.example.com/v1"
        );
        // An `@` in the path must not rewrite the URL into a bogus host.
        assert_eq!(
            sanitize_base_url_for_log("https://host/v1/path@weird"),
            "https://host/v1/path@weird"
        );
        // Multiple `@`: only the authority's userinfo is dropped, never leaked.
        assert_eq!(
            sanitize_base_url_for_log("https://user:pa@ss@host/v1"),
            "https://host/v1"
        );
        // A path with no userinfo must not be mistaken for credentials.
        assert_eq!(
            sanitize_base_url_for_log("https://host/proxy@v1"),
            "https://host/proxy@v1"
        );
        // Non-absolute input is replaced by a marker, never echoed back.
        assert_eq!(sanitize_base_url_for_log("api.example.com/v1"), "<invalid-url>");
        assert_eq!(sanitize_base_url_for_log("not a url"), "<invalid-url>");
        // Clean URLs pass through untouched.
        assert_eq!(
            sanitize_base_url_for_log("https://api.groq.com/openai/v1"),
            "https://api.groq.com/openai/v1"
        );
    }

    #[test]
    fn test_error_kind_status_boundaries() {
        assert_eq!(error_kind_status(400), "bad_request");
        assert_eq!(error_kind_status(401), "unauthorized");
        assert_eq!(error_kind_status(403), "forbidden");
        assert_eq!(error_kind_status(404), "not_found");
        assert_eq!(error_kind_status(408), "request_timeout");
        assert_eq!(error_kind_status(429), "rate_limit");
        assert_eq!(error_kind_status(500), "server_error");
        assert_eq!(error_kind_status(503), "server_error");
        assert_eq!(error_kind_status(599), "server_error");
        // Redirects and informational codes must NOT be reported as server errors.
        assert_eq!(error_kind_status(100), "api_error");
        assert_eq!(error_kind_status(301), "api_error");
        assert_eq!(error_kind_status(302), "api_error");
        assert_eq!(error_kind_status(0), "api_error");
        assert_eq!(error_kind_status(999), "api_error");
    }
}

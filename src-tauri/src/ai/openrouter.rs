use std::time::{Duration, Instant};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;

use super::client::{AiError, AiHttpClient};
use super::prompts::DEFAULT_INITIAL_PROMPT;

pub const OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";
pub const OPENROUTER_AUDIO_URL: &str = "https://openrouter.ai/api/v1/audio/transcriptions";
pub const OPENROUTER_AUTH_KEY_URL: &str = "https://openrouter.ai/api/v1/auth/key";
pub const OPENROUTER_REFERER: &str = "https://github.com/vt-voice";
pub const OPENROUTER_TITLE: &str = "vt-voice";

const AUDIO_TIMEOUT_SECS: u64 = 25;

#[derive(Deserialize)]
struct WhisperResponse {
    text: String,
}

/// Sanitize error messages to ensure API keys are never leaked to logs or UI
pub fn sanitize_error_message(message: &str, api_key: &str) -> String {
    let trimmed_key = api_key.trim();
    if !trimmed_key.is_empty() && trimmed_key.len() > 6 && message.contains(trimmed_key) {
        message.replace(trimmed_key, "[REDACTED_API_KEY]")
    } else {
        message.to_string()
    }
}

/// Transcribe in-memory WAV audio bytes using OpenRouter or custom OpenAI-compatible endpoint
pub async fn transcribe_openrouter(
    http: &AiHttpClient,
    api_key: &str,
    model: &str,
    wav_bytes: Vec<u8>,
    custom_vocab: &[String],
    custom_endpoint: Option<&str>,
) -> Result<String, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }

    // Minimum WAV header (44 bytes) + at least 300ms of 16kHz 16-bit mono PCM (4800 bytes)
    if wav_bytes.len() < 44 + 4800 {
        return Err(AiError::AudioTooShort);
    }

    let mut initial_prompt = DEFAULT_INITIAL_PROMPT.to_string();
    if !custom_vocab.is_empty() {
        initial_prompt.push_str(", ");
        initial_prompt.push_str(&custom_vocab.join(", "));
    }

    let file_part = Part::bytes(wav_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| AiError::ParseError(e.to_string()))?;

    let model_name = if model.trim().is_empty() {
        "openai/whisper-1"
    } else {
        model.trim()
    };

    let form = Form::new()
        .part("file", file_part)
        .text("model", model_name.to_string())
        .text("language", "vi")
        .text("response_format", "json")
        .text("temperature", "0.0")
        .text("prompt", initial_prompt);

    let url = custom_endpoint
        .filter(|e| !e.trim().is_empty())
        .unwrap_or(OPENROUTER_AUDIO_URL);

    let is_openrouter = url.contains("openrouter.ai");

    let mut req = http
        .client
        .post(url)
        .bearer_auth(key)
        .timeout(Duration::from_secs(AUDIO_TIMEOUT_SECS))
        .multipart(form);

    if is_openrouter {
        req = req
            .header("HTTP-Referer", OPENROUTER_REFERER)
            .header("X-Title", OPENROUTER_TITLE);
    }

    let res = req.send().await.map_err(|e| {
        if e.is_timeout() {
            AiError::Timeout(AUDIO_TIMEOUT_SECS)
        } else {
            AiError::Network(e)
        }
    })?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        let sanitized = sanitize_error_message(&err_body, key);
        return Err(AiError::Api {
            status,
            message: sanitized,
        });
    }

    let data: WhisperResponse = res
        .json()
        .await
        .map_err(|e| AiError::ParseError(format!("Failed to parse Whisper JSON: {}", e)))?;

    Ok(data.text.trim().to_string())
}

/// Test connection to OpenRouter (or Custom Endpoint) and return latency in milliseconds
pub async fn test_openrouter_connection(
    http: &AiHttpClient,
    api_key: &str,
    custom_endpoint: Option<&str>,
) -> Result<u64, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }

    let start = Instant::now();

    let (url, is_openrouter) = match custom_endpoint.filter(|e| !e.trim().is_empty()) {
        Some(endpoint) => {
            // If custom endpoint given, check if it points to /audio/transcriptions -> probe parent /models or base
            if endpoint.ends_with("/audio/transcriptions") {
                (endpoint.replace("/audio/transcriptions", "/models"), false)
            } else {
                (endpoint.to_string(), false)
            }
        }
        None => (OPENROUTER_AUTH_KEY_URL.to_string(), true),
    };

    let mut req = http
        .client
        .get(&url)
        .bearer_auth(key)
        .timeout(http.timeout);

    if is_openrouter {
        req = req
            .header("HTTP-Referer", OPENROUTER_REFERER)
            .header("X-Title", OPENROUTER_TITLE);
    }

    let res = req.send().await?;
    let status = res.status().as_u16();

    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        let sanitized = sanitize_error_message(&err_body, key);
        return Err(AiError::Api {
            status,
            message: sanitized,
        });
    }

    let duration = start.elapsed().as_millis() as u64;
    Ok(duration)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_error_message() {
        let key = "sk-or-v1-secretkey123456789";
        let raw_err = "Error processing request for key sk-or-v1-secretkey123456789: quota exceeded";
        let sanitized = sanitize_error_message(raw_err, key);
        assert!(!sanitized.contains(key));
        assert!(sanitized.contains("[REDACTED_API_KEY]"));
    }
}

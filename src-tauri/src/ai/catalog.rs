use std::time::{Duration, Instant};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

use super::client::{AiError, AiHttpClient};
use super::openrouter::{OPENROUTER_REFERER, OPENROUTER_TITLE};

const OPENROUTER_MODELS_URL: &str = "https://openrouter.ai/api/v1/models";
const CACHE_TTL: Duration = Duration::from_secs(3600); // 1 hour TTL

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SttModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub provider: String,
    pub is_recommended: bool,
}

static OPENROUTER_CACHE: Mutex<Option<(Instant, Vec<SttModelInfo>)>> = Mutex::new(None);

/// Return curated offline fallback models for Groq
pub fn get_groq_fallback_models() -> Vec<SttModelInfo> {
    vec![
        SttModelInfo {
            id: "whisper-large-v3-turbo".to_string(),
            name: "Whisper Large v3 Turbo".to_string(),
            description: Some("Fast, high accuracy transcription optimized for real-time speech".to_string()),
            provider: "groq".to_string(),
            is_recommended: true,
        },
        SttModelInfo {
            id: "whisper-large-v3".to_string(),
            name: "Whisper Large v3".to_string(),
            description: Some("Full Whisper model for noisy audio environments".to_string()),
            provider: "groq".to_string(),
            is_recommended: false,
        },
    ]
}

/// Return curated offline fallback models for OpenRouter
pub fn get_openrouter_fallback_models() -> Vec<SttModelInfo> {
    vec![
        SttModelInfo {
            id: "openai/whisper-1".to_string(),
            name: "OpenAI Whisper v2".to_string(),
            description: Some("Standard OpenAI speech recognition on OpenRouter".to_string()),
            provider: "openrouter".to_string(),
            is_recommended: true,
        },
    ]
}

/// Return curated fallback models for Custom endpoint
pub fn get_custom_fallback_models() -> Vec<SttModelInfo> {
    vec![
        SttModelInfo {
            id: "whisper-1".to_string(),
            name: "Whisper (Custom Endpoint)".to_string(),
            description: Some("OpenAI-compatible self-hosted endpoint or proxy".to_string()),
            provider: "custom".to_string(),
            is_recommended: true,
        },
    ]
}

#[derive(Deserialize)]
struct OpenRouterArchitecture {
    #[allow(dead_code)]
    modality: Option<String>,
    output_modalities: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct OpenRouterModelItem {
    id: String,
    name: Option<String>,
    description: Option<String>,
    architecture: Option<OpenRouterArchitecture>,
}

#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModelItem>,
}

/// Fetch available transcription models from OpenRouter Models API
pub async fn fetch_openrouter_stt_models(
    http: &AiHttpClient,
    api_key: Option<&str>,
) -> Result<Vec<SttModelInfo>, AiError> {
    let mut req = http
        .client
        .get(format!("{}?output_modalities=transcription", OPENROUTER_MODELS_URL))
        .header("HTTP-Referer", OPENROUTER_REFERER)
        .header("X-Title", OPENROUTER_TITLE)
        .timeout(http.timeout);

    if let Some(key) = api_key.filter(|k| !k.trim().is_empty()) {
        req = req.bearer_auth(key.trim());
    }

    let res = req.send().await?;
    if !res.status().is_success() {
        return Ok(get_openrouter_fallback_models());
    }

    let parsed: OpenRouterModelsResponse = match res.json().await {
        Ok(data) => data,
        Err(_) => return Ok(get_openrouter_fallback_models()),
    };

    let mut models: Vec<SttModelInfo> = Vec::new();

    for item in parsed.data {
        let is_transcription = item
            .architecture
            .as_ref()
            .and_then(|a| a.output_modalities.as_ref())
            .map(|mods| mods.iter().any(|m| m == "transcription" || m == "audio"))
            .unwrap_or(false)
            || item.id.contains("whisper");

        if is_transcription {
            let is_rec = item.id == "openai/whisper-1";
            let display_name = item.name.unwrap_or_else(|| item.id.clone());
            models.push(SttModelInfo {
                id: item.id,
                name: display_name,
                description: item.description,
                provider: "openrouter".to_string(),
                is_recommended: is_rec,
            });
        }
    }

    // Ensure default whisper-1 is included if not present
    if !models.iter().any(|m| m.id == "openai/whisper-1") {
        models.insert(
            0,
            SttModelInfo {
                id: "openai/whisper-1".to_string(),
                name: "OpenAI Whisper v2".to_string(),
                description: Some("Standard OpenAI speech recognition on OpenRouter".to_string()),
                provider: "openrouter".to_string(),
                is_recommended: true,
            },
        );
    }

    Ok(models)
}

/// Retrieve STT models for the given provider, respecting cache and fallback
pub async fn get_available_stt_models(
    provider: &str,
    http: &AiHttpClient,
    api_key: Option<&str>,
    force_refresh: bool,
) -> Vec<SttModelInfo> {
    match provider.trim().to_lowercase().as_str() {
        "groq" => get_groq_fallback_models(),
        "custom" => get_custom_fallback_models(),
        "openrouter" => {
            // Check cache
            if !force_refresh {
                let cache = OPENROUTER_CACHE.lock();
                if let Some((instant, models)) = cache.as_ref() {
                    if instant.elapsed() < CACHE_TTL && !models.is_empty() {
                        return models.clone();
                    }
                }
            }

            // Fetch dynamic models
            let fetched = match fetch_openrouter_stt_models(http, api_key).await {
                Ok(models) if !models.is_empty() => models,
                _ => get_openrouter_fallback_models(),
            };

            // Store in cache
            *OPENROUTER_CACHE.lock() = Some((Instant::now(), fetched.clone()));
            fetched
        }
        _ => get_groq_fallback_models(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_groq_fallback_models() {
        let models = get_groq_fallback_models();
        assert_eq!(models.len(), 2);
        assert!(models.iter().any(|m| m.id == "whisper-large-v3-turbo" && m.is_recommended));
    }

    #[test]
    fn test_openrouter_fallback_models() {
        let models = get_openrouter_fallback_models();
        assert!(!models.is_empty());
        assert_eq!(models[0].id, "openai/whisper-1");
        assert!(models[0].is_recommended);
    }
}

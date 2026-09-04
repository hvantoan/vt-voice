use std::time::Instant;
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};

use super::client::{AiError, AiHttpClient};
use super::fallback::LocalPolisher;
use super::prompts::{DEFAULT_INITIAL_PROMPT, DEFAULT_POLISH_SYSTEM_PROMPT};

const GROQ_AUDIO_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL: &str = "https://api.groq.com/openai/v1/models";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiPipelineResult {
    pub raw_text: String,
    pub polished_text: String,
    pub duration_ms: u64,
}

#[derive(Deserialize)]
struct WhisperResponse {
    text: String,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct ChatChoiceMessage {
    content: String,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

/// Transcribe in-memory WAV audio bytes using Groq Whisper-large-v3-turbo
pub async fn transcribe(
    http: &AiHttpClient,
    api_key: &str,
    wav_bytes: Vec<u8>,
    custom_vocab: &[String],
) -> Result<String, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }

    // Minimum WAV header (44 bytes) + at least 300ms of 16kHz 16-bit mono PCM (300 * 32 = 9600 bytes)
    if wav_bytes.len() < 44 + 4800 {
        return Err(AiError::AudioTooShort);
    }

    let mut initial_prompt = DEFAULT_INITIAL_PROMPT.to_string();
    if !custom_vocab.is_empty() {
        initial_prompt.push_str(", ");
        initial_prompt.push_str(&custom_vocab.join(", "));
    }

    let file_part = Part::bytes(wav_bytes)
        .file_name("speech.wav")
        .mime_str("audio/wav")
        .map_err(|e| AiError::ParseError(e.to_string()))?;

    let form = Form::new()
        .part("file", file_part)
        .text("model", "whisper-large-v3-turbo")
        .text("language", "vi")
        .text("response_format", "json")
        .text("temperature", "0.0")
        .text("prompt", initial_prompt);

    let res = http
        .client
        .post(GROQ_AUDIO_URL)
        .bearer_auth(key)
        .timeout(http.timeout)
        .multipart(form)
        .send()
        .await?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(AiError::Api {
            status,
            message: err_body,
        });
    }

    let data: WhisperResponse = res
        .json()
        .await
        .map_err(|e| AiError::ParseError(format!("Failed to parse Whisper JSON: {}", e)))?;

    Ok(data.text.trim().to_string())
}

/// Polish grammar and code-switching speech using Groq Llama-3.3-70b-versatile
pub async fn polish_grammar(
    http: &AiHttpClient,
    api_key: &str,
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
        .unwrap_or(DEFAULT_POLISH_SYSTEM_PROMPT);

    let request_body = ChatCompletionRequest {
        model: "llama-3.3-70b-versatile",
        messages: vec![
            ChatMessage {
                role: "system",
                content: sys_prompt,
            },
            ChatMessage {
                role: "user",
                content: trimmed,
            },
        ],
        temperature: 0.1,
        max_tokens: 512,
    };

    let res = http
        .client
        .post(GROQ_CHAT_URL)
        .bearer_auth(key)
        .timeout(http.timeout)
        .json(&request_body)
        .send()
        .await?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(AiError::Api {
            status,
            message: err_body,
        });
    }

    let data: ChatCompletionResponse = res
        .json()
        .await
        .map_err(|e| AiError::ParseError(format!("Failed to parse Chat JSON: {}", e)))?;

    if let Some(first_choice) = data.choices.into_iter().next() {
        let output = first_choice.message.content.trim().to_string();

        // Anti-hallucination guard: If LLM output is empty or > 2.5x original length, fallback
        if output.is_empty() || output.len() > (trimmed.len() * 3) {
            Ok(LocalPolisher::polish(trimmed))
        } else {
            Ok(output)
        }
    } else {
        Ok(LocalPolisher::polish(trimmed))
    }
}

/// Test connection to Groq and return latency in milliseconds
pub async fn test_connection(http: &AiHttpClient, api_key: &str) -> Result<u64, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }

    let start = Instant::now();
    let res = http
        .client
        .get(GROQ_MODELS_URL)
        .bearer_auth(key)
        .timeout(http.timeout)
        .send()
        .await?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(AiError::Api {
            status,
            message: err_body,
        });
    }

    let duration = start.elapsed().as_millis() as u64;
    Ok(duration)
}

/// Complete pipeline: Transcribe WAV -> Polish Grammar -> Fallback on partial failure
pub async fn run_pipeline(
    http: &AiHttpClient,
    api_key: &str,
    wav_bytes: Vec<u8>,
    custom_vocab: &[String],
    system_prompt: Option<&str>,
) -> Result<AiPipelineResult, AiError> {
    let start = Instant::now();

    // 1. Transcribe audio
    let raw_text = transcribe(http, api_key, wav_bytes, custom_vocab).await?;
    if raw_text.trim().is_empty() {
        return Ok(AiPipelineResult {
            raw_text: String::new(),
            polished_text: String::new(),
            duration_ms: start.elapsed().as_millis() as u64,
        });
    }

    // 2. Polish grammar (with automatic degradation to LocalPolisher if LLM fails)
    let polished_text = match polish_grammar(http, api_key, &raw_text, system_prompt).await {
        Ok(polished) => polished,
        Err(err) => {
            eprintln!(
                "[AI Pipeline] LLM polish failed ({}), falling back to local heuristics: {}",
                err, raw_text
            );
            LocalPolisher::polish(&raw_text)
        }
    };

    let duration_ms = start.elapsed().as_millis() as u64;
    Ok(AiPipelineResult {
        raw_text,
        polished_text,
        duration_ms,
    })
}

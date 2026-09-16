use std::time::Duration;
use serde::Deserialize;

use super::client::{AiError, AiHttpClient};
use super::openrouter::sanitize_error_message;

/// Translation outcome with translated text and detected source language.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationResult {
    pub translated_text: String,
    pub detected_lang: Option<String>,
}

const DEFAULT_CHAT_BASE_URL: &str = "https://api.groq.com/openai/v1";

/// Translate text to Vietnamese via the free Google Translate RPC endpoint (backward compatible).
pub async fn translate_google(http: &AiHttpClient, text: &str) -> Result<String, AiError> {
    translate_google_with_langs(http, text, "auto", "vi")
        .await
        .map(|r| r.translated_text)
}

/// Translate text with configurable source and target languages via Google Translate RPC.
pub async fn translate_google_with_langs(
    http: &AiHttpClient,
    text: &str,
    source_lang: &str,
    target_lang: &str,
) -> Result<TranslationResult, AiError> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(AiError::ParseError("empty input".to_string()));
    }

    let sl = if source_lang.trim().is_empty() { "auto" } else { source_lang.trim() };
    let tl = if target_lang.trim().is_empty() { "vi" } else { target_lang.trim() };

    let url = format!(
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl={}&tl={}&dt=t&q={}",
        sl,
        tl,
        urlencode(trimmed)
    );

    let res = http
        .client
        .get(&url)
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiError::Timeout(3)
            } else {
                AiError::Network(e)
            }
        })?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(AiError::Api { status, message: body });
    }

    let body = res.text().await.map_err(|e| AiError::ParseError(e.to_string()))?;
    parse_google_response_with_lang(&body)
}

/// Tiny URL-encoder (percent-encodes UTF-8), avoiding a dependency for one endpoint.
fn urlencode(input: &str) -> String {
    let mut out = String::new();
    for b in input.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char);
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/// Parse Google RPC response, extracting both translated segments and detected source language.
pub fn parse_google_response_with_lang(body: &str) -> Result<TranslationResult, AiError> {
    let parsed: serde_json::Value = serde_json::from_str(body)
        .map_err(|e| AiError::ParseError(format!("google response: {}", e)))?;
    let rows = parsed
        .get(0)
        .and_then(|v| v.as_array())
        .ok_or_else(|| AiError::ParseError("google response: missing rows".to_string()))?;

    let mut out = String::new();
    for row in rows {
        if let Some(seg) = row.get(0).and_then(|v| v.as_str()) {
            out.push_str(seg);
        }
    }
    if out.trim().is_empty() {
        return Err(AiError::ParseError("google response: empty translation".to_string()));
    }

    // Index 2 contains detected language code (e.g. "en", "vi", "ja")
    let detected_lang = parsed.get(2).and_then(|v| v.as_str()).map(|s| s.to_string());

    Ok(TranslationResult {
        translated_text: out,
        detected_lang,
    })
}

#[allow(dead_code)]
fn parse_google_response(body: &str) -> Result<String, AiError> {
    parse_google_response_with_lang(body).map(|r| r.translated_text)
}

/// OpenAI-compatible chat completion translation fallback (backward compatible).
pub async fn translate_chat(
    http: &AiHttpClient,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    text: &str,
) -> Result<String, AiError> {
    translate_chat_with_lang(http, base_url, api_key, model, text, "vi").await
}

/// OpenAI-compatible chat completion translation with target language specification.
pub async fn translate_chat_with_lang(
    http: &AiHttpClient,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    text: &str,
    target_lang: &str,
) -> Result<String, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    let base = base_url.filter(|e| !e.trim().is_empty()).unwrap_or(DEFAULT_CHAT_BASE_URL);
    let clean_base = super::provider::normalize_base_url(base);
    let url = format!("{}/chat/completions", clean_base);

    let lang_target_name = match target_lang {
        "vi" => "Vietnamese",
        "en" => "English",
        "ja" => "Japanese",
        "zh" => "Chinese",
        "ko" => "Korean",
        "fr" => "French",
        "de" => "German",
        other => other,
    };

    let system_prompt = format!(
        "Translate the following text from its source language to {lang_target_name}. \
Preserve code identifiers, variables, keywords, and technical terms verbatim. Output only the translation."
    );

    let request_body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": trimmed }
        ],
        "temperature": 0.1,
    });

    let res = http
        .client
        .post(&url)
        .bearer_auth(key)
        .timeout(http.timeout)
        .json(&request_body)
        .send()
        .await?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        let sanitized = sanitize_error_message(&err_body, key);
        return Err(AiError::Api { status, message: sanitized });
    }

    let data: ChatCompletionResponse =
        res.json().await.map_err(|e| AiError::ParseError(e.to_string()))?;

    data.choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .ok_or_else(|| AiError::ParseError("chat response: no choices".to_string()))
}
#[derive(Deserialize)]
struct ChatMessage {
    content: String,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_urlencode() {
        assert_eq!(urlencode("hello world"), "hello+world");
        assert_eq!(urlencode("a/b"), "a%2Fb");
        assert_eq!(urlencode(""), "");
    }

    #[test]
    fn test_parse_google_response() {
        let body = r#"[[["Xin chào thế giới","hello world",null,null,1]],null,"en"]"#;
        let out = parse_google_response(body).expect("parse");
        assert_eq!(out, "Xin chào thế giới");

        let res = parse_google_response_with_lang(body).expect("parse with lang");
        assert_eq!(res.translated_text, "Xin chào thế giới");
        assert_eq!(res.detected_lang.as_deref(), Some("en"));
    }

    #[test]
    fn test_chat_parse_via_json() {
        let body = r#"{"choices":[{"message":{"content":"  Bản dịch  "}}]}"#;
        let data: ChatCompletionResponse = serde_json::from_str(body).expect("parse");
        let content = data.choices.into_iter().next().unwrap().message.content;
        assert_eq!(content.trim(), "Bản dịch");
    }
}

use std::time::Duration;
use serde::Deserialize;

use super::client::{AiError, AiHttpClient};
use super::openrouter::sanitize_error_message;

/// Public Google Translate RPC endpoint (free, no key).
const GOOGLE_TRANSLATE_URL: &str =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t";

const DEFAULT_CHAT_BASE_URL: &str = "https://api.groq.com/openai/v1";

/// Translate text to Vietnamese via the free Google Translate RPC endpoint.
///
/// `client` is reused for connection pooling. Short timeout because it is the fast deterministic
/// default over the LLM fallback.
pub async fn translate_google(http: &AiHttpClient, text: &str) -> Result<String, AiError> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(AiError::ParseError("empty input".to_string()));
    }

    let url = format!("{}&q={}", GOOGLE_TRANSLATE_URL, urlencode(trimmed));

    let res = http
        .client
        .get(&url)
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiError::Timeout(2)
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
    let segments = parse_google_response(&body)?;
    Ok(segments)
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

/// Parse Google RPC response: `[[["<vi>","<en>",...]],...]`, concatenating `[0][i][0]`.
fn parse_google_response(body: &str) -> Result<String, AiError> {
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
    Ok(out)
}

/// OpenAI-compatible chat completion translation fallback.
///
/// Reuses the `AiHttpClient` (no new dependency). `base_url` is the OpenAI-compatible root (e.g.
/// `https://api.groq.com/openai/v1`); the request posts to `{base_url}/chat/completions`.
/// `api_key` is used as Bearer and redacted from error messages.
pub async fn translate_chat(
    http: &AiHttpClient,
    base_url: Option<&str>,
    api_key: &str,
    model: &str,
    text: &str,
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

    let request_body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": CHAT_SYSTEM_PROMPT },
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

const CHAT_SYSTEM_PROMPT: &str = "Translate the following text from its source language to Vietnamese. \
Preserve code identifiers, variables, keywords, and technical terms verbatim. Output only the translation.";

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
    }

    #[test]
    fn test_chat_parse_via_json() {
        let body = r#"{"choices":[{"message":{"content":"  Bản dịch  "}}]}"#;
        let data: ChatCompletionResponse = serde_json::from_str(body).expect("parse");
        let content = data.choices.into_iter().next().unwrap().message.content;
        assert_eq!(content.trim(), "Bản dịch");
    }
}

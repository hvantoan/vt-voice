use std::time::Duration;
use serde::Deserialize;

use super::client::{AiError, AiHttpClient};
use super::openrouter::sanitize_error_message;
use super::provider::{error_kind, error_kind_status};

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
        log::warn!(
            target: "vt_voice::ai::translate",
            "Google translate rejected: source_lang={}, target_lang={}, input_len=0, error_kind={}",
            source_lang, target_lang,
            error_kind(&AiError::ParseError(String::new()))
        );
        return Err(AiError::ParseError("empty input".to_string()));
    }

    let sl = if source_lang.trim().is_empty() { "auto" } else { source_lang.trim() };
    let tl = if target_lang.trim().is_empty() { "vi" } else { target_lang.trim() };
    let started = std::time::Instant::now();
    log::info!(
        target: "vt_voice::ai::translate",
        "Google translate started: source_lang={}, target_lang={}, input_len={}",
        sl, tl, trimmed.len()
    );

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
        log::warn!(
            target: "vt_voice::ai::translate",
            "Google translate failed: source_lang={}, target_lang={}, duration_ms={}, error_kind={}",
            sl, tl, started.elapsed().as_millis() as u64, error_kind_status(status)
        );
        return Err(AiError::Api { status, message: body });
    }

    let body = res.text().await.map_err(|e| {
        log::warn!(
            target: "vt_voice::ai::translate",
            "Google translate failed: source_lang={}, target_lang={}, duration_ms={}, error_kind={}",
            sl, tl, started.elapsed().as_millis() as u64,
            error_kind(&AiError::ParseError(e.to_string()))
        );
        AiError::ParseError(e.to_string())
    })?;
    let parsed = parse_google_response_with_lang(&body);
    match &parsed {
        Ok(result) => log::info!(
            target: "vt_voice::ai::translate",
            "Google translate completed: source_lang={}, target_lang={}, duration_ms={}, output_len={}",
            sl, tl, started.elapsed().as_millis() as u64, result.translated_text.len()
        ),
        Err(e) => log::warn!(
            target: "vt_voice::ai::translate",
            "Google translate failed: source_lang={}, target_lang={}, duration_ms={}, error_kind={}",
            sl, tl, started.elapsed().as_millis() as u64, error_kind(e)
        ),
    }
    parsed
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
        log::warn!(
            target: "vt_voice::ai::translate",
            "Chat translate rejected: model={}, target_lang={}, input_len={}, error_kind={}",
            model, target_lang, text.len(),
            error_kind(&AiError::MissingApiKey)
        );
        return Err(AiError::MissingApiKey);
    }
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    let started = std::time::Instant::now();
    log::info!(
        target: "vt_voice::ai::translate",
        "Chat translate started: model={}, target_lang={}, input_len={}",
        model, target_lang, trimmed.len()
    );

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
        .await
        .map_err(|e| {
            let err = if e.is_timeout() { AiError::Timeout(http.timeout.as_secs()) } else { AiError::Network(e) };
            log::warn!(
                target: "vt_voice::ai::translate",
                "Chat translate failed: target_lang={}, duration_ms={}, error_kind={}",
                target_lang, started.elapsed().as_millis() as u64, error_kind(&err)
            );
            err
        })?;

    let status = res.status().as_u16();
    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        let sanitized = sanitize_error_message(&err_body, key);
        log::warn!(
            target: "vt_voice::ai::translate",
            "Chat translate failed: target_lang={}, duration_ms={}, error_kind={}",
            target_lang, started.elapsed().as_millis() as u64, error_kind_status(status)
        );
        return Err(AiError::Api { status, message: sanitized });
    }

    // `status` + `content_type` là metadata, không phải văn bản người dùng. Nhờ chúng mà
    // một hồi quy `parse_error` phân biệt được "gateway trả SSE/HTML" với "shape JSON lệch"
    // mà không cần ghi log body (ràng buộc Zero-PII).
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let data: ChatCompletionResponse = res.json().await.map_err(|e| {
        log::warn!(
            target: "vt_voice::ai::translate",
            "Chat translate failed: target_lang={}, status={}, content_type={}, duration_ms={}, error_kind={}",
            target_lang, status, content_type, started.elapsed().as_millis() as u64,
            error_kind(&AiError::ParseError(e.to_string()))
        );
        AiError::ParseError(e.to_string())
    })?;

    // Nội dung rỗng/none (gateway reasoning có thể trả `"content": null`) là phản hồi không
    // dùng được, phải nổi lên thành lỗi thay vì hiển thị khoảng trắng như bản dịch.
    let out = data
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content.unwrap_or_default().trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| AiError::ParseError("chat response: no usable content".to_string()));
    match &out {
        Ok(text) => log::info!(
            target: "vt_voice::ai::translate",
            "Chat translate completed: target_lang={}, duration_ms={}, output_len={}",
            target_lang, started.elapsed().as_millis() as u64, text.len()
        ),
        Err(e) => log::warn!(
            target: "vt_voice::ai::translate",
            "Chat translate failed: target_lang={}, duration_ms={}, error_kind={}",
            target_lang, started.elapsed().as_millis() as u64, error_kind(e)
        ),
    }
    out
}
#[derive(Deserialize)]
struct ChatMessage {
    /// Gateway kiểu reasoning (9router/ollama) có thể trả `"content": null` kèm
    /// `reasoning_content`; `polish_with_endpoint` đã dùng `Option` cho lý do này.
    #[serde(default)]
    content: Option<String>,
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
        assert_eq!(content.as_deref().unwrap_or_default().trim(), "Bản dịch");
    }

    /// Gateway kiểu reasoning (9router/ollama) trả `"content": null` kèm `reasoning_content`.
    /// Phải deserialize được (không panic) — đây chính là parity với `polish_with_endpoint`.
    #[test]
    fn test_chat_parse_null_content() {
        let body = r#"{"choices":[{"message":{"content":null,"reasoning_content":"..."}}]}"#;
        let data: ChatCompletionResponse = serde_json::from_str(body).expect("parse null content");
        let content = data.choices.into_iter().next().unwrap().message.content;
        assert!(content.is_none());
    }

    /// Response thiếu hẳn trường `content` cũng không được làm hỏng deserialize.
    #[test]
    fn test_chat_parse_missing_content() {
        let body = r#"{"choices":[{"message":{}}]}"#;
        let data: ChatCompletionResponse = serde_json::from_str(body).expect("parse missing content");
        assert!(data.choices.into_iter().next().unwrap().message.content.is_none());
    }
}

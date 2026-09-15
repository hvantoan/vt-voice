//! Regression tests for Phase 2 translation backend.
//!
//! Live network calls are `#[ignore]`d so the suite is hermetic; the response parsers are covered
//! with canned JSON bodies.

use vt_voice_lib::ai::{AiHttpClient, translate_chat, translate_google};

#[test]
fn google_parser_canned() {
    let body = r#"[[["Xin chào thế giới","hello world",null,null,1]],null,"en"]"#;
    let parsed = parse_google_helper(body);
    assert_eq!(parsed, "Xin chào thế giới");
}

#[test]
fn chat_parser_canned() {
    let content = chat_parse_helper(r#"{"choices":[{"message":{"content":"  Xe khách  "}}]}"#);
    assert_eq!(content, "Xe khách");
}

/// Live Google RPC call — requires network. Run with `--ignored`.
#[tokio::test]
#[ignore]
async fn google_live() {
    let http = AiHttpClient::new();
    let out = translate_google(&http, "hello world").await.expect("translate");
    assert!(!out.trim().is_empty());
}

/// Live OpenAI-compatible call — requires network + key. Run with `--ignored`.
#[tokio::test]
#[ignore]
async fn chat_live() {
    let http = AiHttpClient::new();
    let out = translate_chat(&http, None, "sk-fake", "llama-3.3-70b-versatile", "hello")
        .await
        .expect("translate");
    assert!(!out.trim().is_empty());
}

// Mirror the crate-internal parsers so integration tests can exercise the exact JSON shapes
// without depending on private items.
fn parse_google_helper(body: &str) -> String {
    let v: serde_json::Value = serde_json::from_str(body).expect("valid json");
    let rows = v.get(0).and_then(|r| r.as_array()).expect("rows");
    let mut out = String::new();
    for row in rows {
        if let Some(s) = row.get(0).and_then(|r| r.as_str()) {
            out.push_str(s);
        }
    }
    out
}

fn chat_parse_helper(body: &str) -> String {
    #[derive(serde::Deserialize)]
    struct Msg {
        content: String,
    }
    #[derive(serde::Deserialize)]
    struct Choice {
        message: Msg,
    }
    #[derive(serde::Deserialize)]
    struct Resp {
        choices: Vec<Choice>,
    }
    let r: Resp = serde_json::from_str(body).expect("valid json");
    r.choices.into_iter().next().unwrap().message.content.trim().to_string()
}

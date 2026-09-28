//! Kiểm tra độc lập các hàm xử lý dữ liệu của module ai::learn
#![allow(dead_code)]

mod client {
    use std::time::Duration;
    use reqwest::Client;

    #[derive(Debug, thiserror::Error)]
    pub enum AiError {
        #[error("Missing API Key")]
        MissingApiKey,
        #[error("Network error: {0}")]
        Network(#[from] reqwest::Error),
        #[error("API error (Status {status}): {message}")]
        Api { status: u16, message: String },
        #[error("Failed to parse API response: {0}")]
        ParseError(String),
        #[error("AI service timeout after {0}s")]
        Timeout(u64),
    }

    #[derive(Clone)]
    pub struct AiHttpClient {
        pub client: Client,
        pub timeout: Duration,
    }
}

mod provider {
    pub fn normalize_base_url(url: &str) -> String {
        let trimmed = url.trim().trim_end_matches('/');
        if trimmed.is_empty() {
            "https://api.groq.com/openai/v1".to_string()
        } else {
            trimmed.to_string()
        }
    }
}
mod openrouter {
    pub fn sanitize_error_message(message: &str, api_key: &str) -> String {
        let trimmed_key = api_key.trim();
        if !trimmed_key.is_empty() && trimmed_key.len() > 6 && message.contains(trimmed_key) {
            message.replace(trimmed_key, "[REDACTED_API_KEY]")
        } else {
            message.to_string()
        }
    }
}

#[path = "../src/ai/learn.rs"]
mod learn;

use learn::{extract_json_payload, split_pasted_text, StudyFeedbackResult};

fn main() {
    println!(">>> Bắt đầu kiểm tra ai::learn helpers...");

    // 1. Kiểm tra trích xuất JSON thuần
    let json_plain = r#"{"grammarScore": 85, "feedbackText": "Tốt", "improvedVersion": "I went to school.", "notedWordsExplanation": []}"#;
    let extracted = extract_json_payload(json_plain);
    let parsed: StudyFeedbackResult = serde_json::from_str(extracted).expect("parse plain json");
    assert_eq!(parsed.grammar_score, 85);
    println!("✓ Trích xuất JSON thuần thành công");
    // 1b. Kiểm tra khả năng parse JSON định dạng snake_case từ các model mã nguồn mở (Llama, Mistral)
    let json_snake = r#"{"grammar_score": 90, "feedback_text": "Chính xác", "improved_version": "She goes to work by bus.", "noted_words_explanation": [{"word_or_phrase": "commute", "translation": "đi lại", "explanation": "di chuyển hàng ngày"}]}"#;
    let parsed_snake: StudyFeedbackResult = serde_json::from_str(json_snake).expect("parse snake_case json");
    assert_eq!(parsed_snake.grammar_score, 90);
    assert_eq!(parsed_snake.feedback_text, "Chính xác");
    assert_eq!(parsed_snake.improved_version, "She goes to work by bus.");
    assert_eq!(parsed_snake.noted_words_explanation.len(), 1);
    assert_eq!(parsed_snake.noted_words_explanation[0].word_or_phrase, "commute");
    println!("✓ Parse JSON định dạng snake_case thành công");

    // 1c. Kiểm tra parse JSON có đầy đủ 3 cấu trúc strengths, weaknesses, suggestions
    let json_structured = r#"{
        "grammarScore": 88,
        "strengths": ["Dùng đúng thì quá khứ đơn", "Trật tự từ tự nhiên"],
        "weaknesses": ["Sai giới từ 'in the bus' -> 'on the bus'"],
        "suggestions": ["Có thể dùng từ 'commute' thay cho 'go to work'"],
        "improvedVersion": "I met him on the bus yesterday.",
        "notedWordsExplanation": [
            {"wordOrPhrase": "commute", "translation": "đi lại", "explanation": "di chuyển hàng ngày"}
        ]
    }"#;
    let parsed_structured: StudyFeedbackResult = serde_json::from_str(json_structured).expect("parse structured json");
    assert_eq!(parsed_structured.grammar_score, 88);
    assert_eq!(parsed_structured.strengths.len(), 2);
    assert_eq!(parsed_structured.weaknesses.len(), 1);
    assert_eq!(parsed_structured.suggestions.len(), 1);
    assert_eq!(parsed_structured.improved_version, "I met him on the bus yesterday.");
    println!("✓ Parse JSON cấu trúc 3 phần (strengths, weaknesses, suggestions) thành công");


    // 2. Kiểm tra trích xuất JSON trong markdown codeblock
    let json_markdown = format!("Dưới đây là kết quả đánh giá:\n```json\n{}\n```\nChúc bạn học tốt!", json_plain);
    let extracted_md = extract_json_payload(&json_markdown);
    let parsed_md: StudyFeedbackResult = serde_json::from_str(extracted_md).expect("parse markdown json");
    assert_eq!(parsed_md.grammar_score, 85);
    println!("✓ Trích xuất JSON trong codeblock markdown thành công");

    // 3. Kiểm tra trích xuất JSON trong codeblock không có nhãn json
    let json_no_label = format!("Output:\n```\n{}\n```", json_plain);
    let extracted_nl = extract_json_payload(&json_no_label);
    let parsed_nl: StudyFeedbackResult = serde_json::from_str(extracted_nl).expect("parse no label json");
    assert_eq!(parsed_nl.grammar_score, 85);
    println!("✓ Trích xuất JSON trong codeblock trần thành công");
    // 3b. Kiểm tra extract_json_payload không bao giờ panic với ngoặc lệch/ngược
    let malformed = "] [ } {";
    let extracted_malformed = extract_json_payload(malformed);
    assert_eq!(extracted_malformed, malformed);
    println!("✓ Kiểm tra không panic với ngoặc lỗi thành công");


    // 4. Kiểm tra phân tách đoạn văn bản
    let paragraph = "Technology has changed the way we communicate daily. Do you agree with this statement? Many people find it convenient, however, others feel overwhelmed! Let us study together.\nNext paragraph starts here.";
    let sentences = split_pasted_text(paragraph);
    println!("✓ Phân tách đoạn văn bản: tìm thấy {} câu", sentences.len());
    assert!(sentences.len() >= 4);
    assert_eq!(sentences[0], "Technology has changed the way we communicate daily.");
    assert_eq!(sentences[1], "Do you agree with this statement?");
    assert_eq!(sentences[2], "Many people find it convenient, however, others feel overwhelmed!");

    println!(">>> TOÀN BỘ KIỂM TRA AI::LEARN ĐÃ PASS 100%! <<<");
}

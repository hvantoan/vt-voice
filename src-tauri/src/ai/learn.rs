use std::time::Duration;
use serde::{Deserialize, Serialize};

use super::client::{AiError, AiHttpClient};
use super::provider::normalize_base_url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TargetVocabItem {
    pub word: String,
    #[serde(default, alias = "type", alias = "part_of_speech")]
    pub word_type: Option<String>,
    #[serde(alias = "meaning", alias = "translation")]
    pub meaning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NotedWordExplanation {
    #[serde(alias = "word_or_phrase", alias = "word")]
    pub word_or_phrase: String,
    #[serde(alias = "translation", alias = "meaning")]
    pub translation: String,
    #[serde(alias = "explanation", alias = "definition")]
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudyFeedbackResult {
    #[serde(alias = "grammar_score", alias = "score")]
    pub grammar_score: i32,
    #[serde(default, alias = "good_points")]
    pub strengths: Vec<String>,
    #[serde(default, alias = "errors", alias = "improvements")]
    pub weaknesses: Vec<String>,
    #[serde(default, alias = "tips", alias = "recommendations")]
    pub suggestions: Vec<String>,
    #[serde(default, alias = "feedback_text", alias = "feedback", alias = "comment")]
    pub feedback_text: String,
    #[serde(default, alias = "improved_version", alias = "suggestion", alias = "improved")]
    pub improved_version: String,
    #[serde(default, alias = "noted_words_explanation", alias = "noted_words", alias = "vocab")]
    pub noted_words_explanation: Vec<NotedWordExplanation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedSentenceItem {
    #[serde(alias = "source_text", alias = "sentence")]
    pub source_text: String,
    #[serde(alias = "reference_translation", alias = "translation")]
    pub reference_translation: Option<String>,
    #[serde(default, alias = "acceptable_alternatives", alias = "alternatives")]
    pub acceptable_alternatives: Option<Vec<String>>,
    #[serde(default, alias = "target_vocab", alias = "vocab")]
    pub target_vocab: Option<Vec<TargetVocabItem>>,
    #[serde(default, alias = "grammar_focus", alias = "grammar")]
    pub grammar_focus: Option<String>,
    #[serde(default, alias = "common_mistakes", alias = "mistakes")]
    pub common_mistakes: Option<Vec<String>>,
    #[serde(alias = "difficulty_level", alias = "level")]
    pub difficulty_level: Option<String>,
    #[serde(alias = "category", alias = "topic")]
    pub category: Option<String>,
}

/// Trích xuất chuỗi JSON từ phản hồi LLM an toàn, bất kể LLM bọc trong codeblock markdown hay kèm lời thoại.
pub fn extract_json_payload(raw: &str) -> &str {
    let trimmed = raw.trim();

    // 1. Kiểm tra ```json ... ```
    if let Some(start_idx) = trimmed.find("```json") {
        let content_start = start_idx + 7;
        if let Some(end_idx) = trimmed[content_start..].rfind("```") {
            return trimmed[content_start..content_start + end_idx].trim();
        }
    }

    // 2. Kiểm tra ``` ... ```
    if let Some(start_idx) = trimmed.find("```") {
        let content_start = start_idx + 3;
        // Bỏ qua tên ngôn ngữ nếu có (vd: ```javascript\n)
        let line_end = trimmed[content_start..]
            .find('\n')
            .map(|i| content_start + i + 1)
            .unwrap_or(content_start);

        if let Some(end_idx) = trimmed[line_end..].rfind("```") {
            return trimmed[line_end..line_end + end_idx].trim();
        }
    }

    // 3. Tìm khối JSON bao bởi '{' ... '}' hoặc '[' ... ']'
    let first_brace = trimmed.find('{');
    let last_brace = trimmed.rfind('}');
    let first_bracket = trimmed.find('[');
    let last_bracket = trimmed.rfind(']');

    match (first_brace, last_brace, first_bracket, last_bracket) {
        (Some(fb), Some(lb), Some(fk), Some(lk)) => {
            if fb <= lb && fk <= lk {
                if fb < fk && lb > lk {
                    &trimmed[fb..=lb]
                } else if fk < fb && lk > lb {
                    &trimmed[fk..=lk]
                } else if fb < fk {
                    &trimmed[fb..=lb]
                } else {
                    &trimmed[fk..=lk]
                }
            } else if fb <= lb {
                &trimmed[fb..=lb]
            } else if fk <= lk {
                &trimmed[fk..=lk]
            } else {
                trimmed
            }
        }
        (Some(fb), Some(lb), _, _) if fb <= lb => &trimmed[fb..=lb],
        (_, _, Some(fk), Some(lk)) if fk <= lk => &trimmed[fk..=lk],
        _ => trimmed,
    }

}

/// Phân tách đoạn văn bản dài thành danh sách các câu hoàn chỉnh riêng biệt.
pub fn split_pasted_text(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let re = regex::Regex::new(r"(?s)(.+?[.!?]+(?:\s+|\r?\n+|$)|[^\r\n.!?]+(?:\r?\n+|$))")
        .unwrap_or_else(|_| regex::Regex::new(r".+").unwrap());

    for cap in re.captures_iter(text) {
        if let Some(matched) = cap.get(0) {
            let sentence = matched.as_str().trim();
            if sentence.chars().count() >= 3 {
                sentences.push(sentence.to_string());
            }
        }
    }

    if sentences.is_empty() {
        let trimmed = text.trim();
        if trimmed.chars().count() >= 3 {
            sentences.push(trimmed.to_string());
        }
    }

    sentences
}

/// Đánh giá bài nộp dịch thuật và sinh feedback 3 phần qua 1 request duy nhất tới LLM.
pub async fn evaluate_translation_attempt(
    http: &AiHttpClient,
    base_url: &str,
    api_key: &str,
    model: &str,
    source_text: &str,
    user_translation: &str,
    source_lang: &str,
    target_lang: &str,
    noted_words: &[String],
) -> Result<StudyFeedbackResult, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }

    let clean_base = normalize_base_url(base_url);
    let url = format!("{}/chat/completions", clean_base);

    let noted_words_json = serde_json::to_string(noted_words).unwrap_or_else(|_| "[]".to_string());

    let system_prompt = "You are an expert bilingual English-Vietnamese language tutor specializing in grammar correction, translation evaluation, and linguistic feedback. \
Evaluate the user's translation attempt against the source text. Your evaluation must be encouraging, constructive, and strictly structured into strengths, weaknesses, and actionable suggestions in Vietnamese. \
\
CRITERIA: \
- grammarScore: integer 0-100 (90-100: flawless/native-like; 75-89: minor slips; 50-74: noticeable errors; 0-49: major errors/distorted meaning). \
- strengths: array of 1-3 concise Vietnamese bullet points highlighting what the user did well (e.g. correct tense, vocabulary choice, word order). \
- weaknesses: array of 0-3 concise Vietnamese bullet points identifying specific errors (e.g. preposition, grammar, phrasing). If the translation is 100% flawless, return an empty array []. \
- suggestions: array of 1-2 practical Vietnamese tips to sound more natural (e.g. idiomatic collocations, alternative expressions). \
- improvedVersion: a single fluent, idiomatic translation in the target language. \
- notedWordsExplanation: array of definitions and usage notes in Vietnamese for any requested words/phrases. \
\
You MUST respond with ONLY a single valid JSON object strictly matching this schema, with NO markdown codeblocks, NO preamble, and NO extra text: \
{ \
  \"grammarScore\": <integer 0-100>, \
  \"strengths\": [\"<điểm làm tốt 1>\"], \
  \"weaknesses\": [\"<lỗi cần sửa 1>\"], \
  \"suggestions\": [\"<đề xuất diễn đạt hay hơn 1>\"], \
  \"improvedVersion\": \"<câu dịch tự nhiên chuẩn>\", \
  \"notedWordsExplanation\": [ \
    { \
      \"wordOrPhrase\": \"<word or phrase requested by user>\", \
      \"translation\": \"<nghĩa tiếng Việt hoặc tiếng Anh>\", \
      \"explanation\": \"<giải thích ngữ pháp hoặc ngữ cảnh>\" \
    } \
  ] \
}";

    let user_content = format!(
        "Source sentence ({source_lang}): \"{source_text}\"\n\
User's translation ({target_lang}): \"{user_translation}\"\n\
Words/phrases noted by user to explain: {noted_words_json}"
    );

    let request_body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_content }
        ],
        "temperature": 0.2,
    });

    let timeout = if http.timeout < Duration::from_secs(60) {
        Duration::from_secs(60)
    } else {
        http.timeout
    };

    let res = http
        .client
        .post(&url)
        .bearer_auth(key)
        .timeout(timeout)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiError::Timeout(timeout.as_secs())
            } else {
                AiError::Network(e)
            }
        })?;

    let status = res.status();
    let body_text = res.text().await.map_err(AiError::Network)?;

    if !status.is_success() {
        let clean_msg = super::openrouter::sanitize_error_message(&body_text, key);
        return Err(AiError::Api {
            status: status.as_u16(),
            message: clean_msg,
        });
    }

    let parsed_val: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| AiError::ParseError(format!("Invalid response JSON: {e}")))?;

    let raw_content = parsed_val["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AiError::ParseError("Missing choices[0].message.content".to_string()))?;

    let json_str = extract_json_payload(raw_content);
    let mut result: StudyFeedbackResult = serde_json::from_str(json_str).map_err(|e| {
        log::warn!("vt_voice::ai::learn: Failed to parse feedback JSON: {e}, raw content: {raw_content}");
        AiError::ParseError(format!("Failed to parse feedback result: {e}"))
    })?;

    // Fallback: Nếu feedback_text rỗng nhưng có mảng cấu trúc, tự động dựng văn bản tổng hợp
    if result.feedback_text.trim().is_empty() {
        let mut parts = Vec::new();
        if !result.strengths.is_empty() {
            parts.push(format!("Điểm tốt:\n- {}", result.strengths.join("\n- ")));
        }
        if !result.weaknesses.is_empty() {
            parts.push(format!("Cần sửa:\n- {}", result.weaknesses.join("\n- ")));
        }
        if !result.suggestions.is_empty() {
            parts.push(format!("Đề xuất:\n- {}", result.suggestions.join("\n- ")));
        }
        result.feedback_text = parts.join("\n\n");
    }

    Ok(result)
}

/// Sinh các câu luyện tập mới theo chủ đề và trình độ.
pub async fn generate_sentences(
    http: &AiHttpClient,
    base_url: &str,
    api_key: &str,
    model: &str,
    topic: &str,
    level: &str,
    source_lang: &str,
    target_lang: &str,
    count: usize,
) -> Result<Vec<GeneratedSentenceItem>, AiError> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err(AiError::MissingApiKey);
    }

    let clean_base = normalize_base_url(base_url);
    let url = format!("{}/chat/completions", clean_base);

    let system_prompt = format!(
        "You are an expert language teacher creating bilingual practice sentences and self-contained exercise packets. \
Generate {count} distinct, natural, practical practice sentences for learners. \
Topic: {topic} \
CEFR Level: {level} (A1=Beginner, A2=Elementary, B1=Intermediate, B2=Upper-Intermediate, C1=Advanced, C2=Mastery) \
Source Language: {source_lang} \
Target Language: {target_lang} \
You MUST respond with a single valid JSON array strictly matching this schema, with NO markdown codeblocks, NO preamble, and NO extra text:
[
  {{
    \"sourceText\": \"<sentence in source language>\",
    \"referenceTranslation\": \"<canonical accurate natural translation in target language>\",
    \"acceptableAlternatives\": [\"<alternative valid translation 1>\", \"<alternative valid translation 2>\"],
    \"targetVocab\": [
      {{
        \"word\": \"<key word or phrase in source language>\",
        \"type\": \"<part of speech e.g. verb, noun, adj, idiom>\",
        \"meaning\": \"<meaning/definition in target language>\"
      }}
    ],
    \"grammarFocus\": \"<concise explanation in target language of key grammar rule or pattern used>\",
    \"commonMistakes\": [\"<common pitfall or error learners make with this sentence>\"]
  }}
]"
    );

    let request_body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": format!("Generate {count} sentences for topic '{topic}' at level '{level}'.") }
        ],
        "temperature": 0.3,
    });

    let timeout = if http.timeout < Duration::from_secs(60) {
        Duration::from_secs(60)
    } else {
        http.timeout
    };

    let res = http
        .client
        .post(&url)
        .bearer_auth(key)
        .timeout(timeout)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                AiError::Timeout(timeout.as_secs())
            } else {
                AiError::Network(e)
            }
        })?;

    let status = res.status();
    let body_text = res.text().await.map_err(AiError::Network)?;

    if !status.is_success() {
        let clean_msg = super::openrouter::sanitize_error_message(&body_text, key);
        return Err(AiError::Api {
            status: status.as_u16(),
            message: clean_msg,
        });
    }

    let parsed_val: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| AiError::ParseError(format!("Invalid response JSON: {e}")))?;

    let raw_content = parsed_val["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AiError::ParseError("Missing choices[0].message.content".to_string()))?;

    let json_str = extract_json_payload(raw_content);
    let items: Vec<GeneratedSentenceItem> = serde_json::from_str(json_str).map_err(|e| {
        log::warn!("vt_voice::ai::learn: Failed to parse generated sentences JSON: {e}, raw content: {raw_content}");
        AiError::ParseError(format!("Failed to parse generated sentences: {e}"))
    })?;

    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_payload_markdown_json() {
        let input = "Here is the result:\n```json\n{\"grammarScore\": 90, \"feedbackText\": \"Good job!\", \"improvedVersion\": \"Hello\", \"notedWordsExplanation\": []}\n```\nHope this helps!";
        let extracted = extract_json_payload(input);
        assert!(extracted.starts_with('{'));
        assert!(extracted.ends_with('}'));
        let parsed: StudyFeedbackResult = serde_json::from_str(extracted).expect("parse json");
        assert_eq!(parsed.grammar_score, 90);
    }

    #[test]
    fn test_extract_json_payload_plain_object() {
        let input = "{\"grammarScore\": 80, \"feedbackText\": \"Ok\", \"improvedVersion\": \"Fine\", \"notedWordsExplanation\": []}";
        let extracted = extract_json_payload(input);
        assert_eq!(extracted, input);
    }
    #[test]
    fn test_extract_json_payload_structured_feedback() {
        let input = r#"{
            "grammarScore": 88,
            "strengths": ["Dùng đúng thì quá khứ đơn", "Trật tự từ tốt"],
            "weaknesses": ["Sai giới từ in -> on"],
            "suggestions": ["Có thể dùng từ commute"],
            "improvedVersion": "I met him on the bus",
            "notedWordsExplanation": [
                {"wordOrPhrase": "bus", "translation": "xe buýt", "explanation": "Phương tiện công cộng"}
            ]
        }"#;
        let extracted = extract_json_payload(input);
        let parsed: StudyFeedbackResult = serde_json::from_str(extracted).expect("parse structured json");
        assert_eq!(parsed.grammar_score, 88);
        assert_eq!(parsed.strengths.len(), 2);
        assert_eq!(parsed.weaknesses.len(), 1);
        assert_eq!(parsed.suggestions.len(), 1);
        assert_eq!(parsed.improved_version, "I met him on the bus");
        assert_eq!(parsed.noted_words_explanation.len(), 1);
        assert_eq!(parsed.feedback_text, "");
    }

    #[test]
    fn test_extract_json_payload_array() {
        let input = "```\n[\n  {\"sourceText\": \"Sentence 1\", \"referenceTranslation\": \"Câu 1\", \"difficultyLevel\": \"A1\", \"category\": \"Daily\"}\n]\n```";
        let extracted = extract_json_payload(input);
        assert!(extracted.starts_with('['));
        assert!(extracted.ends_with(']'));
        let items: Vec<GeneratedSentenceItem> = serde_json::from_str(extracted).expect("parse items");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].source_text, "Sentence 1");
    }
    #[test]
    fn test_extract_json_payload_enriched_packet() {
        let input = r#"[
            {
                "sourceText": "They postponed the meeting until Friday.",
                "referenceTranslation": "Họ đã hoãn cuộc họp đến thứ Sáu.",
                "acceptableAlternatives": ["Họ dời cuộc họp sang thứ Sáu."],
                "targetVocab": [
                    {"word": "postpone", "type": "verb", "meaning": "hoãn lại, trì hoãn"}
                ],
                "grammarFocus": "Thì quá khứ đơn (past simple) và giới từ until.",
                "commonMistakes": ["Dùng nhầm giới từ to thay vì until."]
            }
        ]"#;
        let items: Vec<GeneratedSentenceItem> = serde_json::from_str(input).expect("parse enriched items");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].source_text, "They postponed the meeting until Friday.");
        assert_eq!(items[0].acceptable_alternatives.as_ref().unwrap().len(), 1);
        assert_eq!(items[0].target_vocab.as_ref().unwrap().len(), 1);
        assert_eq!(items[0].target_vocab.as_ref().unwrap()[0].word, "postpone");
        assert_eq!(items[0].grammar_focus.as_deref(), Some("Thì quá khứ đơn (past simple) và giới từ until."));
        assert_eq!(items[0].common_mistakes.as_ref().unwrap().len(), 1);
    }


    #[test]
    fn test_split_pasted_text() {
        let input = "Hello world. How are you doing? I am fine! This is a test sentence.\nAnother paragraph starts here.\n\nAnd one more!";
        let sentences = split_pasted_text(input);
        assert!(sentences.len() >= 4);
        assert_eq!(sentences[0], "Hello world.");
        assert_eq!(sentences[1], "How are you doing?");
    }
}

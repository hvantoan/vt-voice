---
title: "Phase 3: AI Learning Engine & Tauri IPC Commands"
status: complete
priority: P1
effort: 3.5h
---

# Phase 3: AI Learning Engine & Tauri IPC Commands

## Overview

Xây dựng module xử lý AI cho việc học tập (`src-tauri/src/ai/learn.rs`) và hệ thống các Tauri IPC commands tương ứng trong `src-tauri/src/lib.rs`. Module này tận dụng cấu hình AI provider hiện có của người dùng (Groq / OpenRouter / Custom) để:
1. Đánh giá bản dịch và sinh feedback 3 phần chuẩn hóa JSON trong **MỘT request duy nhất**.
2. Tự động sinh câu luyện tập theo Chủ đề và Trình độ (A1–C2).
3. Phân tách đoạn văn bản người dùng dán vào thành các câu riêng biệt và lưu vào CSDL.
4. Cung cấp API truy vấn Sổ tay từ vựng và Lịch sử bài tập.

## AI Prompt Contract (Single-Pass Feedback)

### System & User Prompt Structure
Prompt yêu cầu LLM trả về định dạng JSON thuần túy (không kèm markdown code block hoặc bao bằng ```json ```):
```json
{
  "grammar_score": 85,
  "feedback_text": "Cấu trúc câu tốt. Tuy nhiên nên chú ý thì quá khứ của động từ 'go' là 'went' thay vì 'goed'.",
  "improved_version": "I went to the store yesterday to buy some groceries.",
  "noted_words_explanation": [
    {
      "word_or_phrase": "groceries",
      "translation": "hàng tạp hóa, thực phẩm",
      "explanation": "Danh từ số nhiều chỉ các mặt hàng thực phẩm và đồ dùng gia đình mua ở siêu thị/chợ."
    }
  ]
}
```

### AI Sentence Generation Prompt
Prompt yêu cầu LLM sinh 3–5 câu song ngữ theo chủ đề và trình độ được chọn:
```json
[
  {
    "source_text": "Could you please send me the updated quarterly report by this afternoon?",
    "reference_translation": "Bạn có thể vui lòng gửi cho tôi báo cáo quý cập nhật trước chiều nay không?",
    "difficulty_level": "B2",
    "category": "Business"
  }
]
```

## Related Code Files

### Files to Create
- `src-tauri/src/ai/learn.rs`: Structs `StudyFeedbackResult`, `NotedWordExplanation`, `GeneratedSentenceItem`, các prompt templates và hàm `evaluate_translation_attempt()`, `generate_sentences()`.

### Files to Modify
- `src-tauri/src/ai/mod.rs`: Xuất bản module `learn`.
- `src-tauri/src/lib.rs`: Đăng ký các Tauri command IPC:
  - `submit_study_attempt`
  - `generate_study_sentences`
  - `save_pasted_sentences`
  - `get_study_sentences`
  - `delete_study_sentence`
  - `get_saved_vocab`
  - `delete_saved_vocab`
  - `get_study_history`

## Implementation Steps

1. **Module `src-tauri/src/ai/learn.rs`**:
   - Xây dựng DTOs phản hồi feedback:
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct NotedWordExplanation {
         pub word_or_phrase: String,
         pub translation: String,
         pub explanation: String,
     }

     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct StudyFeedbackResult {
         pub grammar_score: i32,
         pub feedback_text: String,
         pub improved_version: String,
         pub noted_words_explanation: Vec<NotedWordExplanation>,
     }
     ```
   - Viết hàm `evaluate_translation_attempt`:
     - Nhận: `http_client`, `provider_url`, `api_key`, `model`, `source_text`, `user_translation`, `source_lang`, `target_lang`, `noted_words`.
     - Xây dựng prompt kèm format JSON bắt buộc.
     - Gọi POST `/chat/completions` (OpenAI format).
     - Phân tích cú pháp JSON an toàn (có hàm fallback trích xuất JSON nếu LLM bọc trong codeblock markdown).
   - Viết hàm `generate_sentences`:
     - Nhận: `topic`, `level`, `source_lang`, `target_lang`, `count`.
     - Gọi LLM và trích xuất mảng câu song ngữ.
2. **Hàm phân tách đoạn văn (`split_pasted_text`)**:
   - Tách đoạn văn thành từng câu bằng regex Unicode `(?<=[.!?])\s+|\n+`.
   - Lọc bỏ các câu quá ngắn (< 3 ký tự) hoặc khoảng trắng.
3. **Đăng ký Tauri Commands (`src-tauri/src/lib.rs`)**:
   - `submit_study_attempt`: Thực hiện đánh giá qua AI, sau đó lưu attempt vào `study_attempts` và lưu các từ vựng đã giải nghĩa vào `saved_vocab`.
   - `generate_study_sentences`: Gọi AI sinh câu, lưu các câu vào `study_sentences` với `origin = 'ai_generated'`.
   - `save_pasted_sentences`: Tách đoạn văn thành các câu, lưu vào `study_sentences` với `origin = 'pasted'`.
   - `get_study_sentences`, `delete_study_sentence`.
   - `get_saved_vocab`, `delete_saved_vocab`.
   - `get_study_history`.

## Todo

- [X] Tạo module `src-tauri/src/ai/learn.rs` với các struct và hàm gọi LLM.
- [X] Viết hàm parse JSON phản hồi an toàn, chống lỗi khi model trả về markdown block.
- [X] Viết hàm phân tách câu cho văn bản dán tự do.
- [X] Đăng ký 8 Tauri IPC command trong `src-tauri/src/lib.rs`.
- [X] Chạy `cd src-tauri && cargo check` xác nhận kiểu dữ liệu khớp hoàn toàn.

## Success Criteria

- Lệnh `submit_study_attempt` trả về đầy đủ 3 phần: điểm/nhận xét ngữ pháp, câu mẫu cải tiến, và giải thích từ note.
- Lệnh `save_pasted_sentences` phân tách chính xác đoạn văn thành danh sách câu sạch.
- Dữ liệu lượt làm bài và từ vựng tự động được lưu vào SQLite sau khi chấm điểm thành công.

---
title: "Phase 6: Structured Evaluation Feedback (Green Strengths, Red Weaknesses, Amber Suggestions)"
status: complete
priority: P1
effort: 2.5h
---

# Phase 6: Structured Evaluation Feedback (Green / Red / Suggestions)

## Overview

Nâng cấp kết quả đánh giá (evaluation feedback) trong module Học tiếng Anh từ một khối văn bản đơn thuần (`feedbackText`) thành cấu trúc 3 phần trực quan:
1. **🟢 Điểm làm tốt (Strengths)**: Hiển thị nền xanh lá (`emerald`), chỉ ra các cấu trúc, thì, hoặc từ vựng dùng đúng.
2. **🔴 Cần cải thiện (Weaknesses / Errors)**: Hiển thị nền đỏ (`rose`), chỉ ra lỗi ngữ pháp, giới từ, mạo từ hoặc cách diễn đạt sai.
3. **💡 Đề xuất diễn đạt (Suggestions)**: Hiển thị nền hổ phách (`amber`), gợi ý cách dùng từ tự nhiên hoặc thành ngữ/collocation bản xứ hơn.

Đi kèm là bản dịch tự nhiên gợi ý (`improvedVersion`) và giải nghĩa từ vựng đã note (`notedWordsExplanation`).

## Scope & Changes

### 1. Backend Rust (`src-tauri/src/ai/learn.rs` & `src-tauri/src/lib.rs`)
- Cập nhật DTO `StudyFeedbackResult`:
  ```rust
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
      #[serde(alias = "improved_version", alias = "suggestion")]
      pub improved_version: String,
      #[serde(default, alias = "noted_words_explanation", alias = "noted_words")]
      pub noted_words_explanation: Vec<NotedWordExplanation>,
      #[serde(default, alias = "feedback_text")]
      pub feedback_text: Option<String>,
  }
  ```
- Nâng cấp `system_prompt` trong `evaluate_translation_attempt`:
  - Ràng buộc cấu trúc JSON chứa `strengths` (array of strings), `weaknesses` (array of strings), `suggestions` (array of strings).
  - Tiêu chí chấm điểm chi tiết (0-100).
  - Hướng dẫn rõ ràng bằng tiếng Việt cho người học.
- Lưu CSDL `study_attempts.feedback_text`:
  - Serialize toàn bộ `StudyFeedbackResult` dưới dạng JSON string để lưu vào SQLite mà không cần thay đổi schema bảng.

### 2. Frontend Types & Localization (`src/components/settings/vocab/types.ts`, `vi.json`, `en.json`)
- Cập nhật interface `StudyFeedbackResult`:
  ```typescript
  export interface StudyFeedbackResult {
    grammarScore: number;
    strengths?: string[];
    weaknesses?: string[];
    suggestions?: string[];
    improvedVersion: string;
    notedWordsExplanation: NotedWordExplanation[];
    feedbackText?: string;
  }
  ```
- Thêm i18n keys song ngữ trong `vi.json` và `en.json`:
  - `vocab.strengths_title`: "Điểm làm tốt" / "Strengths"
  - `vocab.weaknesses_title`: "Cần cải thiện" / "Areas to Improve"
  - `vocab.suggestions_title`: "Đề xuất diễn đạt" / "Suggestions"
  - `vocab.no_weaknesses`: "Tuyệt vời! Không phát hiện lỗi sai ngữ pháp đáng kể." / "Great job! No major grammar errors detected."

### 3. Frontend UI (`FeedbackPanel.tsx`, `StudyMode.tsx`, `VocabNotebook.tsx`)
- `FeedbackPanel.tsx`:
  - Render khối Green (`strengths`) với icon `CheckCircle2` và bullet points.
  - Render khối Red (`weaknesses`) với icon `AlertCircle` và bullet points (hoặc trạng thái hoàn hảo nếu rỗng).
  - Render khối Amber (`suggestions`) với icon `Lightbulb` và bullet points.
  - Hỗ trợ fallback hiển thị dạng paragraph nếu là dữ liệu cũ (chỉ có `feedbackText`).
- `StudyMode.tsx`:
  - Khôi phục feedback từ SQLite attempt: parse JSON nếu `feedbackText` chứa JSON, ngược lại giữ nguyên text cũ.
- `VocabNotebook.tsx`:
  - Khôi phục và hiển thị các bullet point trong lịch sử bài tập.

## Verification
- `bun test`: Kiểm tra toàn bộ 72+ test cases, đặc biệt là `tests/i18n.test.ts` (100% parity giữa `vi.json` và `en.json`).
- `cd src-tauri && cargo check`: Đảm bảo compile sạch, không có lỗi kiểu.

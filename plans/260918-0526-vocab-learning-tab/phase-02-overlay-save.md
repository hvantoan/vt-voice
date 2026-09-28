---
title: "Phase 2: Translate Overlay Quick-Save Action"
status: complete
priority: P1
effort: 2h
---

# Phase 2: Translate Overlay Quick-Save Action

## Overview

Hiện thực hóa tính năng lưu tức thì từ cửa sổ dịch bôi đen (`Alt+T`): Khi người dùng dịch một đoạn văn bản ngoài màn hình bằng `translate-overlay`, giao diện popover cung cấp một nút hành động "Lưu vào bài học" (Save to Study) để ghi câu nguồn và bản dịch vào SQLite `learn.db` (`origin = 'overlay'`).

## Key Insights & UI Interaction

1. **Vị trí nút bấm**: Nằm cạnh nút Sao chép (Copy) trên thanh điều khiển của `TranslateOverlay.tsx`.
2. **Trạng thái trực quan (Visual Feedback)**:
   - Trạng thái mặc định: Icon `BookmarkPlus` với tooltip "Lưu vào bài học (Tab Vocab)".
   - Trạng thái đang lưu: Icon `Loader2` quay nhẹ.
   - Trạng thái đã lưu: Icon `Check` màu xanh ngọc bích (`text-emerald-400`) tồn tại trong 1.5 giây, sau đó chuyển sang `BookmarkCheck`.
3. **IPC Command `save_sentence_from_overlay`**:
   - Nhận payload: `{ sourceText: string, translatedText: string, sourceLang?: string, targetLang?: string }`.
   - Sinh UUID v4, kiểm tra tránh trùng lặp câu gần nhất, ghi vào bảng `study_sentences` với `origin = 'overlay'`.
   - Trả về `Result<StudySentence, String>`.

## Related Code Files

### Files to Modify
- `src-tauri/src/lib.rs`: Khai báo và đăng ký `#[tauri::command] save_sentence_from_overlay`.
- `src/components/TranslateOverlay.tsx`: Thêm nút icon lưu câu và xử lý sự kiện `onSaveToStudy`.
- `src/locales/vi.json`: Thêm chuỗi `overlay.save_to_study`, `overlay.saved_to_study`.
- `src/locales/en.json`: Thêm chuỗi `overlay.save_to_study`, `overlay.saved_to_study`.

## Implementation Steps

1. **Backend Rust IPC Command (`src-tauri/src/lib.rs`)**:
   ```rust
   #[tauri::command]
   async fn save_sentence_from_overlay(
       state: State<'_, AppState>,
       source_text: String,
       translated_text: String,
       source_lang: Option<String>,
       target_lang: Option<String>,
   ) -> Result<StudySentence, String> {
       let trimmed_source = source_text.trim();
       if trimmed_source.is_empty() {
           return Err("Source text cannot be empty".into());
       }
       let db = state.learn_db.lock();
       db.add_sentence(NewSentence {
           source_lang: source_lang.unwrap_or_else(|| "auto".to_string()),
           target_lang: target_lang.unwrap_or_else(|| "vi".to_string()),
           source_text: trimmed_source.to_string(),
           reference_translation: Some(translated_text.trim().to_string()),
           difficulty_level: None,
           category: Some("Overlay".to_string()),
           origin: "overlay".to_string(),
       }).map_err(|e| e.to_string())
   }
   ```
   - Thêm command vào danh sách `tauri::generate_handler![..., save_sentence_from_overlay]`.
2. **Frontend UI Integration (`src/components/TranslateOverlay.tsx`)**:
   - Import icon `BookmarkPlus`, `BookmarkCheck` từ `lucide-react`.
   - Thêm state `isSaving: boolean` và `isSaved: boolean`.
   - Khi click nút: gọi `invoke("save_sentence_from_overlay", { sourceText, translatedText, sourceLang, targetLang })`.
   - Set `isSaved = true` và hiển thị icon `BookmarkCheck` trong 1.5s.
3. **Phím tắt trong Overlay (Tùy chọn)**:
   - Nếu popover mở và có kết quả: người dùng có thể click chuột trực tiếp (cửa sổ overlay hỗ trợ tương tác chuột hoàn toàn).

## Todo

- [X] Tạo IPC command `save_sentence_from_overlay` trong `src-tauri/src/lib.rs`.
- [X] Thêm command vào `tauri::generate_handler!`.
- [X] Cập nhật `TranslateOverlay.tsx` để render nút icon Lưu cạnh nút Copy.
- [X] Thêm i18n keys vào `src/locales/vi.json` và `src/locales/en.json`.
- [X] Kiểm tra phản hồi trực quan khi bấm nút lưu trên overlay.

## Success Criteria

- Khi mở translate overlay bằng `Alt+T` và dịch xong câu, nút Lưu hiển thị rõ ràng.
- Bấm nút Lưu gọi IPC thành công và tạo một bản ghi mới trong bảng `study_sentences` với `origin = 'overlay'`.
- Nút chuyển sang trạng thái đã lưu (`BookmarkCheck`) mà không làm crash hay đơ popover.

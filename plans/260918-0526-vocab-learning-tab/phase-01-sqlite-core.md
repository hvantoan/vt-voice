---
title: "Phase 1: SQLite Backend Core & AppState Setup"
status: complete
priority: P1
effort: 3h
---

# Phase 1: SQLite Backend Core & AppState Setup

## Overview

Thiết lập tầng cơ sở dữ liệu SQLite local nhúng cho `vt-voice` thông qua crate `rusqlite = { version = "0.32", features = ["bundled"] }`. Khởi tạo CSDL ngay khi ứng dụng khởi động (`App Setup`) và đưa vào `AppState` để chia sẻ an toàn giữa các luồng xử lý và các cửa sổ (`translate-overlay` và `main`).

## Key Insights & Architectural Decisions

1. **Khởi tạo tại Startup**: Người dùng cần lưu tức thì câu đang dịch từ cửa sổ Translate Overlay (`Alt+T`). Vì vậy, `LearnDb` được khởi tạo cùng `AppState` ngay trong hàm `setup()` của `src-tauri/src/lib.rs`.
2. **Độc lập và An toàn luồng**: Kết nối được bảo vệ bởi `Arc<parking_lot::Mutex<LearnDb>>`. Các tác vụ đọc/ghi diễn ra nhanh trên SQLite cục bộ (thường <2ms) nên không gây block luồng giao diện chính.
3. **Vị trí lưu trữ**: File CSDL đặt tại `%APPDATA%/.vt-voice/learn.db` (đồng bộ với vị trí của `settings.json` và `history.json`).
4. **ID chuẩn UUID v4**: Mọi thực thể (`StudySentence`, `StudyAttempt`, `SavedVocab`) dùng UUID v4 string làm khóa chính để sẵn sàng đồng bộ lên cloud trong Phase 2 mà không xung đột ID.

## Schema Definition

```sql
CREATE TABLE IF NOT EXISTS study_sentences (
    id TEXT PRIMARY KEY,
    source_lang TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    source_text TEXT NOT NULL,
    reference_translation TEXT,
    difficulty_level TEXT, -- A1, A2, B1, B2, C1, C2
    category TEXT,         -- Daily, Business, Tech, Overlay, Custom
    origin TEXT NOT NULL,  -- 'overlay', 'pasted', 'ai_generated'
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS study_attempts (
    id TEXT PRIMARY KEY,
    sentence_id TEXT,
    user_translation TEXT NOT NULL,
    grammar_score INTEGER,
    feedback_text TEXT NOT NULL,
    improved_version TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(sentence_id) REFERENCES study_sentences(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_vocab (
    id TEXT PRIMARY KEY,
    word_or_phrase TEXT NOT NULL,
    source_context TEXT,
    translation TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sentences_created ON study_sentences(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_sentence ON study_attempts(sentence_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON study_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vocab_created ON saved_vocab(created_at DESC);
```

## Related Code Files

### Files to Modify
- `src-tauri/Cargo.toml`: Thêm dependency `rusqlite = { version = "0.32", features = ["bundled"] }`.
- `src-tauri/src/storage/mod.rs`: Xuất bản module `learn_db`.
- `src-tauri/src/lib.rs`: Khởi tạo `LearnDb` trong `AppState`.

### Files to Create
- `src-tauri/src/storage/learn_db.rs`: Struct `LearnDb`, các DTO structs (`StudySentence`, `StudyAttempt`, `SavedVocab`), và các hàm thực thi SQL CRUD.

## Implementation Steps

1. **Cập nhật `src-tauri/Cargo.toml`**:
   - Thêm `rusqlite = { version = "0.32", features = ["bundled"] }`.
   - Thêm `uuid = { version = "1", features = ["v4"] }` (nếu chưa có).
2. **Tạo module `src-tauri/src/storage/learn_db.rs`**:
   - Xây dựng struct `LearnDb` bọc `rusqlite::Connection`.
   - Viết hàm `init(db_path: &Path) -> Result<Self, LearnDbError>`.
   - Tạo phương thức `run_migrations(&self) -> Result<(), ...>`.
   - Viết các hàm CRUD:
     - `add_sentence(&self, sentence: NewSentence) -> Result<StudySentence, ...>`
     - `list_sentences(&self, limit: usize) -> Result<Vec<StudySentence>, ...>`
     - `get_sentence(&self, id: &str) -> Result<Option<StudySentence>, ...>`
     - `delete_sentence(&self, id: &str) -> Result<bool, ...>`
     - `add_attempt(&self, attempt: NewAttempt) -> Result<StudyAttempt, ...>`
     - `list_attempts(&self, sentence_id: Option<&str>, limit: usize) -> Result<Vec<StudyAttempt>, ...>`
     - `add_vocab(&self, vocab: NewVocab) -> Result<SavedVocab, ...>`
     - `list_vocab(&self) -> Result<Vec<SavedVocab>, ...>`
     - `delete_vocab(&self, id: &str) -> Result<bool, ...>`
3. **Đăng ký vào `AppState` trong `src-tauri/src/lib.rs`**:
   - Khởi tạo thư mục config `%APPDATA%/.vt-voice/` nếu chưa tồn tại.
   - Gọi `LearnDb::init(&db_path)` và bọc vào `Arc::new(Mutex::new(learn_db))`.
   - Thêm field `pub learn_db: Arc<Mutex<LearnDb>>` vào `AppState`.
4. **Viết unit test cho `LearnDb`**:
   - Tạo unit test trong bộ nhớ (`rusqlite::Connection::open_in_memory()`) để kiểm tra việc tạo schema, insert và query dữ liệu.

## Todo

- [X] Thêm `rusqlite` vào `src-tauri/Cargo.toml`.
- [X] Tạo file `src-tauri/src/storage/learn_db.rs` và khai báo trong `src-tauri/src/storage/mod.rs`.
- [X] Định nghĩa đầy đủ DTOs (`StudySentence`, `StudyAttempt`, `SavedVocab`) với `serde::{Serialize, Deserialize}`.
- [X] Hiện thực các truy vấn SQL an toàn với prepared statements.
- [X] Tích hợp `learn_db` vào `AppState` trong `src-tauri/src/lib.rs`.
- [X] Chạy `cd src-tauri && cargo check` xác nhận biên dịch không lỗi.

## Success Criteria

- Schema SQLite tự động khởi tạo thành công khi chạy app.
- `cargo check` pass hoàn toàn.
- File `%APPDATA%/.vt-voice/learn.db` được tạo với cấu trúc 3 bảng và 4 index chuẩn xác.

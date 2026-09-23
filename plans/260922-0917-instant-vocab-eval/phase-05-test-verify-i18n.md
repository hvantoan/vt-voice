---
title: "Phase 5: Testing, Benchmarking & Localization"
status: complete
---

# Phase 5: Testing, Benchmarking & Localization

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Pre-requisites: [Phase 1](./phase-01-start.md), [Phase 2](./phase-02-local-eval-engine.md), [Phase 3](./phase-03-instant-feedback-ui.md), [Phase 4](./phase-04-on-demand-ai-history.md)
- Test Files: `tests/local-evaluation.test.ts`, `tests/i18n.test.ts`
- Dictionaries: `src/locales/vi.json`, `src/locales/en.json`

## Overview
- **Priority**: P1 (Verification & Quality Gate)
- **Status**: Todo
- **Description**: Thực hiện kiểm thử tự động toàn diện cho bộ engine đánh giá cục bộ, đo lường benchmark hiệu năng độ trễ (< 5ms), xác nhận tính tương thích ngược với CSDL cũ và đảm bảo tính đối xứng song ngữ 100% giữa `vi.json` và `en.json`.

## Key Insights
- Bài kiểm tra độ trễ (latency benchmark) là tiêu chí cốt lõi: Đảm bảo khi người dùng nhấn `Enter`, hàm `evaluateLocalAttempt` hoàn thành trong nháy mắt mà không gây lag luồng render chính của React.
- Mọi chuỗi giao diện hiển thị trong `InstantFeedbackPanel` phải được quốc tế hóa qua `useI18n()` và có đầy đủ bản dịch trong cả `vi.json` lẫn `en.json`.
- Các bài kiểm tra unit test cho thuật toán Damerau-Levenshtein và Myers Diff phải bao quát tất cả các ca biên (chuỗi rỗng, một từ, câu dài, nhiều từ thừa/thiếu liên tiếp).

<!-- Updated: Validation Session 1 - Test assertions for strict <= 3 chars typo rule and starter pack seed -->
## Requirements
### Functional Requirements
- [ ] Tạo file test `tests/local-evaluation.test.ts`:
  - **Nhóm 1: Normalizer Tests**:
    - Chuẩn hóa chữ thường và khoảng trắng thừa.
    - Loại bỏ dấu câu ở các vị trí khác nhau.
    - Mở rộng đúng các dạng viết tắt (`I'm`, `don't`, `can't`, `won't`, `they'll`, v.v.).
  - **Nhóm 2: Damerau-Levenshtein Tests**:
    - Độ tương đồng giữa 2 từ giống hệt nhau = 0.
    - Đảo 2 ký tự liền kề (`teh` $\to$ `the`) khoảng cách = 1.
    - Thêm 1 ký tự (`bookk` $\to$ `book`) khoảng cách = 1.
    - Xóa 1 ký tự (`bok` $\to$ `book`) khoảng cách = 1.
  - **Nhóm 3: Myers Token Diff Tests**:
    - Hai câu giống nhau $\to$ 100% tokens có `status: "correct"`.
    - Câu có từ viết sai nhẹ $\to$ token có `status: "typo"`.
    - Câu thiếu từ $\to$ xuất hiện token `status: "missing"`.
    - Câu có từ thừa $\to$ xuất hiện token `status: "extraneous"`.
    - Câu dùng sai từ $\to$ xuất hiện token `status: "replaced"`.
  - **Nhóm 4: Multi-tier Matching Tests**:
    - Khớp chính xác câu chuẩn $\to$ score = 100.
    - Khớp với một trong các `acceptableAlternatives` $\to$ score = 100.
    - Khớp có lỗi typo nhẹ $\to$ score = 90 - 95.
    - Câu dịch sai nhiều $\to$ score thấp tương ứng tỷ lệ từ đúng.
  - **Nhóm 5: Short Word Typo Boundary & Transposition Tests**:
    - Các từ $\le 2$ ký tự (`he` vs `me`, `in` vs `on`) và các cặp từ 3 ký tự có nghĩa khác nhau (`cat` vs `car`) bắt buộc không được coi là `typo` (phân loại là `replaced`).
    - Lỗi đảo chữ 3 ký tự non-word (`teh` vs `the`) và các từ $\ge 4$ ký tự (`bookk` vs `book`, `recieved` vs `received`) vẫn nhận diện `typo` chính xác.
- [ ] Đồng bộ từ điển i18n (`vi.json` & `en.json`):
  - `vocab.instant_feedback_title`: "Kết quả tức thì" / "Instant Result"
  - `vocab.score_perfect`: "Hoàn hảo!" / "Perfect!"
  - `vocab.score_typo`: "Chính xác (Lỗi gõ nhẹ)" / "Correct (Minor Typo)"
  - `vocab.score_good`: "Khá tốt, cần lưu ý" / "Good Effort"
  - `vocab.score_needs_review`: "Cần xem lại" / "Needs Review"
  - `vocab.matched_alternative`: "Khớp với cách diễn đạt tương đương" / "Matched alternative phrasing"
  - `vocab.ask_ai_deep`: "Hỏi AI chi tiết" / "Ask AI Deep Dive"
  - `vocab.target_vocab_title`: "Từ vựng trọng tâm" / "Key Vocabulary"
  - `vocab.grammar_focus_title`: "Trọng tâm ngữ pháp" / "Grammar Focus"
  - `vocab.common_mistakes_title`: "Bẫy lỗi thường gặp" / "Common Mistakes"
  - `vocab.shortcut_instant_next`: "↵ Nhấn Enter để sang câu tiếp theo" / "↵ Press Enter for next sentence"
  - `vocab.copy_canonical`: "Sao chép câu chuẩn" / "Copy Canonical Translation"

### Non-functional Requirements
- `bun test tests/local-evaluation.test.ts` chạy xong dưới `500ms`.
- `bun test tests/i18n.test.ts` pass 100% không lệch bất kỳ key nào.
- `cd src-tauri && cargo check` biên dịch thành công 100%.

## Related Code Files

### Files to Create
- `tests/local-evaluation.test.ts`

### Files to Modify
- `src/locales/vi.json`
- `src/locales/en.json`

## File Inventory Table

| File | Action | Description | Test Impact |
|---|---|---|---|
| `tests/local-evaluation.test.ts` | Create | 30+ assertions cho toàn bộ thuật toán đánh giá | Chạy qua `bun test` |
| `src/locales/vi.json` | Modify | Thêm các key từ vựng và feedback tiếng Việt | Kiểm thử qua `tests/i18n.test.ts` |
| `src/locales/en.json` | Modify | Thêm các key từ vựng và feedback tiếng Anh | Kiểm thử qua `tests/i18n.test.ts` |

## Test Scenario Matrix

| ID | Path | Priority | Scenario Description | Expected Outcome |
|---|---|---|---|---|
| TS-P5-01 | Unit Test Suite | Critical | Chạy toàn bộ test trong `local-evaluation.test.ts` | 30/30 assertions pass |
| TS-P5-02 | i18n Parity | Critical | Chạy `tests/i18n.test.ts` | 0 missing keys, 100% parity |
| TS-P5-03 | Rust Check | Critical | Chạy `cargo check` trong `src-tauri` | Biên dịch không lỗi |
| TS-P5-04 | Performance Benchmark | High | Chạy 1000 lượt `evaluateLocalAttempt` liên tục | Thời gian trung bình $< 2\text{ms}$/lượt |
| TS-P5-05 | Full Suite Integration | High | Chạy `bun test` toàn bộ repository | Tất cả các suite đều pass |
| TS-P5-06 | Short Word Strict Tests | Critical | Chạy unit tests cho các cặp từ $\le 2$ ký tự (`he`/`me`, `in`/`on`) và cặp 3 ký tự (`cat`/`car`) | Trả về `replaced`, không trả về `typo` |
| TS-P5-07 | 3-char Transposition Test | Critical | Chạy unit test cho `teh` so với `the` | Trả về `typo` (khoảng cách Damerau-Levenshtein = 1) |
| TS-P5-08 | Starter Pack DB Seed Test | High | Chạy kiểm tra khởi tạo CSDL SQLite rỗng | 15–20 câu mẫu được nạp sẵn thành công |

## Todo List
- [x] Viết bộ test `tests/local-evaluation.test.ts` đầy đủ các nhóm kiểm thử
- [x] Bổ sung tất cả các key i18n vào `src/locales/vi.json` và `src/locales/en.json`
- [x] Chạy `bun test tests/i18n.test.ts` xác nhận tính đối xứng
- [x] Chạy `cd src-tauri && cargo check` kiểm tra mã nguồn Rust
- [x] Đo đạc benchmark hiệu năng thực tế

## Success Criteria
- [ ] `bun test tests/local-evaluation.test.ts` pass 100%.
- [ ] `bun test tests/i18n.test.ts` pass 100%.
- [ ] `cargo check` thành công.
- [ ] Thời gian xử lý của `evaluateLocalAttempt` đo được dưới `5ms`.

## Risk Assessment
- **Risk**: Một số key mới trong `vi.json` bị thiếu hoặc sai chính tả so với `en.json`.
  - *Mitigation*: Test `tests/i18n.test.ts` sẽ tự động phát hiện và chặn nếu có bất kỳ sự lệch pha nào giữa 2 từ điển.

## Security Considerations
- Không có rủi ro bảo mật bổ sung trong giai đoạn kiểm thử.

## Next Steps
- Hoàn tất kế hoạch, tiến hành Red Team review và Validation trước khi bước vào triển khai (`/ak:cook`).

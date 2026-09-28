---
title: "Phase 5: Localization, Testing & Verification"
status: complete
priority: P1
effort: 2h
---

# Phase 5: Localization, Testing & Verification

## Overview

Hoàn thiện việc bản địa hóa song ngữ (`vi.json` và `en.json`), thực thi kiểm thử tự động, và kiểm tra toàn diện các kịch bản sử dụng thực tế (E2E) từ cửa sổ Translate Overlay đến Tab Vocab trong Cài đặt.

## Key Requirements & Invariants

1. **Parity i18n tuyệt đối**: Mọi key trong `vi.json` phải có mặt trong `en.json` và ngược lại. Test `tests/i18n.test.ts` phải pass 100%.
2. **An toàn kiểu dữ liệu Rust**: `cargo check` trong thư mục `src-tauri` không có bất kỳ lỗi nào.
3. **Bảo toàn giao diện 720x560**: Không có hiện tượng tràn nội dung, cắt xén dấu tiếng Việt (tuân thủ quy tắc padding dọc cho tiếng Việt trong `AGENTS.md`).

## Verification Matrix

| Kịch bản kiểm thử | Hành động | Kết quả mong đợi | Phương pháp |
|---|---|---|---|
| **1. i18n Parity** | Chạy `bun test tests/i18n.test.ts` | 100% key khớp nhau, 0 lỗi | Tự động |
| **2. Rust Backend Build** | Chạy `cd src-tauri && cargo check` | Exit code 0, không có compilation error | Tự động |
| **3. Overlay Quick Save** | Dịch bằng `Alt+T`, bấm nút Lưu câu | Icon chuyển thành Check xanh, câu lưu vào SQLite `origin='overlay'` | Thủ công |
| **4. Dán đoạn văn** | Bấm Dán đoạn văn bản trong Tab Vocab | Đoạn văn được tách thành các câu riêng biệt trong CSDL | Thủ công |
| **5. AI sinh câu** | Chọn Topic 'Business' & Level 'B2' | 3 câu mới được sinh và nạp vào danh sách luyện tập | Thủ công |
| **6. Token Selection** | Click 1 từ và Ctrl+Click từ thứ hai | Cả 2 từ được highlight, danh sách chip hiển thị đúng 2 từ | Thủ công |
| **7. Nộp bài & Feedback** | Gõ bản dịch và bấm `Ctrl+Enter` | Nhận feedback 3 phần (Điểm/Ngữ pháp - Gợi ý tự nhiên - Giải nghĩa từ note) | Thủ công |
| **8. Sổ tay từ vựng** | Mở view Sổ tay từ vựng và xóa 1 từ | Từ hiển thị kèm ngữ cảnh; bấm xóa thì từ bị xóa khỏi SQLite | Thủ công |

## Related Code Files

### Files to Modify
- `src/locales/vi.json`: Bổ sung toàn bộ chuỗi tiếng Việt cho tab Vocab và nút lưu Overlay.
- `src/locales/en.json`: Bổ sung toàn bộ chuỗi tiếng Anh tương ứng.
- `docs/research/03-tauri-arch-ux.md`: Cập nhật ghi chú về quyết định sử dụng SQLite local cho tính năng học tập.

## Implementation Steps

1. **Cập nhật từ điển `vi.json` và `en.json`**:
   - Thêm nhóm key `tabs.vocab`.
   - Thêm nhóm key `overlay.save_to_study`, `overlay.saved_to_study`.
   - Thêm nhóm key `vocab.*` (bao gồm practice, notebook, history, feedback, errors, placeholders).
2. **Chạy kiểm thử i18n**:
   - Chạy `bun test tests/i18n.test.ts` và sửa ngay nếu có key bị lệch.
3. **Chạy kiểm thử Rust**:
   - Chạy `cargo check` trong `src-tauri`.
4. **Kiểm tra trực quan (Smoke Test)**:
   - Khởi động app bằng `bun run tauri dev` hoặc kiểm tra Vite dev server `bun run dev`.
   - Xác nhận layout vừa vặn trong 720x560.

## Todo

- [X] Cập nhật đầy đủ bản dịch vào `src/locales/vi.json` và `src/locales/en.json`.
- [X] Chạy `bun test tests/i18n.test.ts` đạt kết quả pass (1433 expect calls).
- [X] Chạy `cargo check` trong `src-tauri` đạt kết quả pass (0 warnings, 0 errors).
- [X] Viết và chạy tests tự động `tests/vocab.test.ts` (9 tests pass) và 2 standalone probes `verify_learn_db`, `verify_learn_ai` (pass 100%).
- [ ] Thực hiện smoke test thủ công trực tiếp trên desktop qua `bun run tauri dev` (kịch bản 3–8 trong ma trận).
- [X] Cập nhật tài liệu `docs/research/03-tauri-arch-ux.md`.

## Success Criteria

- Toàn bộ test tự động pass.
- Luồng hoạt động từ Translate Overlay -> SQLite -> Tab Vocab hoạt động trơn tru.
- Mã nguồn sạch sẽ, không có console log thừa hay warning chưa xử lý.

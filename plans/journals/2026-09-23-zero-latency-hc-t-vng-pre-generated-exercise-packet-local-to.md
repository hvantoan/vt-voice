---
title: "Zero-Latency Học từ vựng: Pre-generated Exercise Packet & Local Token Diff"
date: 2026-09-23
summary: "Triển khai trọn vẹn mô hình 2 tầng Zero-Latency Học từ vựng: sinh gói bài tập tự trị, so khớp đa tầng < 5ms, UI Token Diff trực quan và Starter Pack 15 câu mẫu."
---

# Zero-Latency Học từ vựng: Pre-generated Exercise Packet & Local Token Diff

## What happened
Đã triển khai hoàn tất kế hoạch "Zero-Latency Học từ vựng: Pre-generated Exercise Packet & Local Token Diff" theo đúng kiến trúc 2 tầng (Two-Tier Hybrid Architecture) đã được duyệt:
1. SQLite & Backend:
   - Thêm 4 cột JSON cho bảng `study_sentences` (`acceptable_alternatives`, `target_vocab`, `grammar_focus`, `common_mistakes`).
   - Tích hợp Starter Pack 15 câu mẫu đa dạng cấp độ (Beginner, Intermediate, Advanced) kèm đầy đủ cấu trúc packet, tự động seed khi database rỗng.
   - Bổ sung lệnh IPC `save_local_study_attempt` để ghi nhận kết quả đánh giá tức thì vào `study_attempts` ngầm không chặn UI.
2. Local Evaluation Engine:
   - Xây dựng thuật toán so khớp đa tầng: Text Normalizer & Contractions, Damerau-Levenshtein Typo Tolerance, và Needleman-Wunsch/Myers Token Diff.
   - Chuẩn hóa quy tắc Typo: Từ <= 2 ký tự bắt buộc distance = 0 (phân loại replaced); từ 3 ký tự cho phép đảo chữ/typo non-word (`teh` -> `the`) nhưng phân loại replaced cho các từ có nghĩa khác nhau (`cat` -> `car`).
3. Frontend & Diagnostic UI:
   - Xây dựng `InstantFeedbackPanel.tsx` với hiển thị Token Diff trực quan theo màu (Đúng/Lỗi gõ/Sai/Thừa/Thiếu), đáp án chuẩn, từ vựng mục tiêu, mẹo ngữ pháp và bẫy lỗi.
   - Hỗ trợ One-Click Replace khi click vào từ gợi ý và tự động bôi đen con trỏ vào từ sai đầu tiên trong `textarea`.
   - Điều hướng thông minh với phím Enter: điểm >= 85 tự động chuyển sang câu tiếp theo, điểm < 85 hỗ trợ sửa từ rồi nhấn Enter để chấm lại hoặc Ctrl+ArrowRight để bỏ qua.
   - Tách tính năng "Hỏi AI chi tiết" thành On-Demand, chạy bất đồng bộ với indicator riêng.
4. Testing & Verification:
   - Đạt 110/110 tests pass trong `bun test`, bao gồm 22 assertions chuyên sâu trong `tests/local-evaluation.test.ts`.
   - Parity 100% giữa `vi.json` và `en.json` với 1541 assertions.
   - `cargo check` và `bun run build` biên dịch sạch sẽ không lỗi.

## Decision
- Chuẩn hóa `wordType` trên Frontend TypeScript interface và component `InstantFeedbackPanel.tsx` để tương thích hoàn toàn với Rust serialization.
- Ngưỡng chuyển câu tự động của phím Enter được cố định ở >= 85 điểm để bảo đảm chất lượng học tập.
- Tự động nạp Starter Pack 15 câu mẫu ngay khi khởi tạo CSDL giúp người dùng có thể trải nghiệm ngay lập tức (zero setup).

## Next steps
- Tiếp tục theo dõi phản hồi thực tế từ người dùng khi thao tác phím Enter liên tục ở tốc độ cao.
- Mở rộng thêm các chủ đề từ vựng chuyên sâu (IELTS, TOEIC, IT) trong các bản cập nhật tiếp theo.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

---
title: "Plan: Popover Tra Từ Vựng & Thêm Vào Sổ Tay Bằng AI"
date: 2026-09-23
summary: "Lập kế hoạch hoàn chỉnh cho tính năng Popover tra từ trực tiếp, làm giàu dữ liệu bằng AI lưu vào sổ tay và cấu hình min window size 640x480."
---

# Plan: Popover Tra Từ Vựng & Thêm Vào Sổ Tay Bằng AI

## What happened
Đã lập kế hoạch hoàn chỉnh cho tính năng: "Popover Tra Từ Vựng, Thêm Vào Sổ Tay Bằng AI & Responsive Min Window Size" (plans/260923-0413-vocab-popover-enrich):
1. Phase 1: Cấu hình kích thước tối thiểu `minWidth: 640`, `minHeight: 480` cho cửa sổ `main` trong `tauri.conf.json` và hoàn thiện responsive styling.
2. Phase 2: Xây dựng module AI làm giàu từ vựng (`enrich_vocab_with_ai`) sinh IPA, từ loại, giải thích và câu ví dụ minh họa, kèm IPC command `save_single_vocab`.
3. Phase 3: Tích hợp Radix Popover trực tiếp tại từng token trong `TokenizedSentence.tsx` với cơ chế chống tràn màn hình (`collisionPadding={12}`), hiển thị tra từ nhanh và nút lưu sổ tay bằng AI.
4. Phase 4: Nâng cấp hiển thị Sổ tay từ vựng (`VocabNotebook.tsx`) để trình bày phiên âm IPA, từ loại, câu ví dụ trích dẫn và đồng bộ song ngữ `vi.json` / `en.json`.
5. Phase 5: Kiểm thử tự động toàn diện (`tests/vocab.test.ts`, `tests/i18n.test.ts`), build verification (`cargo check`, `bun run build`).

## Decision
- Khống chế kích thước tối thiểu 640x480 để giữ nguyên bố cục 2 cột (sidebar 176px + content 464px) mà không cần viết thêm logic collapse sidebar phức tạp.
- Sử dụng Radix Popover trực tiếp tại từng token từ vựng kèm cơ chế collision detection để mang lại trải nghiệm đọc hiểu tiện lợi nhất mà không bao giờ bị cắt viền.

## Next steps
- Sẵn sàng chuyển giao sang bước triển khai (`/ak:cook plans/260923-0413-vocab-popover-enrich/plan.md`).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

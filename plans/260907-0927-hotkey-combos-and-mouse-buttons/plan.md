---
title: "hotkey-combos-and-mouse-buttons"
description: "Hỗ trợ gán tổ hợp phím (Key chords) và phím chuột 4, 5 (XButton 1/2) cho Hotkey toàn hệ thống"
status: pending
priority: P1
effort: "4h"
tags: ["hotkey", "mouse-hook", "chord-recorder", "tauri", "windows-api"]
created: 2026-09-07
---

# hotkey-combos-and-mouse-buttons

## Overview
Khắc phục triệt để vấn đề không gán được tổ hợp phím (ví dụ `Ctrl + Space`, `Alt + Shift + X`) và phím phụ chuột (Chuột 4/5 - `VK_XBUTTON1`/`VK_XBUTTON2`, Chuột giữa `VK_MBUTTON`) trong ứng dụng vt-voice. Giải pháp bao gồm:
1. **Backend (Rust/Win32):** Tích hợp thêm hook chuột toàn cục `WH_MOUSE_LL` song song với `WH_KEYBOARD_LL`, sửa lỗi kẹt cờ `IS_HELD` khi nhả tổ hợp phím trong Push-to-Talk và Toggle, và kích hoạt `update_config` khi lưu cấu hình.
2. **Frontend (React/TypeScript):** Cải tiến `HotkeyRecorder.tsx` để ghi nhận phím dạng tổ hợp (chờ nhả phím hoặc bấm phím chính thay vì ngắt ngay khi bấm modifier đầu tiên), lắng nghe sự kiện chuột (`mousedown`/`auxclick`) ngăn chặn hành vi Back/Forward mặc định của webview, cùng các nút gán nhanh (Quick Presets) cho chuột 4/5.
3. **Kiểm thử & Xác thực:** Bộ unit test Rust kiểm tra tính toán so khớp/nhả phím tổ hợp và chuột, cùng quy trình kiểm tra build frontend và kiểm thử chức năng thực tế.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Cài đặt `WH_MOUSE_LL` trong `src-tauri` để bắt sự kiện chuột hông (XButton 1, 2) và chuột giữa toàn hệ thống | P1 |
| 2 | Sửa logic so khớp nhả phím (`matches_release`) tránh kẹt trạng thái Push-to-Talk / Toggle khi nhả modifier trước phím chính | P1 |
| 3 | Cập nhật cấu hình tức thì trong `save_app_config` (`state.hotkey_manager.update_config`) không cần khởi động lại app | P1 |
| 4 | Nâng cấp `HotkeyRecorder.tsx` bắt được tổ hợp phím và các phím chuột, hỗ trợ phím tắt gợi ý nhanh | P1 |
| 5 | Đảm bảo tương thích ngược 100% với phím mặc định `Right Alt` (0xA5) | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Backend Hook & Combo Release Engine](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Frontend Hotkey & Mouse Recorder](./phase-02-frontend-hotkey-mouse-recorder.md) | Pending |
| 3 | [Phase 3: Integration, Testing & End-to-End Verification](./phase-03-integration-testing-verification.md) | Pending |

## Success Criteria

- [ ] Người dùng có thể gán các tổ hợp phím (`Ctrl + Space`, `Alt + Shift + V`, v.v.) trực tiếp trên giao diện Cài đặt.
- [ ] Người dùng có thể click hoặc chọn Chuột 4 (`Mouse 4` / `XButton 1`), Chuột 5 (`Mouse 5` / `XButton 2`), hoặc Chuột giữa (`Mouse 3`).
- [ ] Push-to-Talk hoạt động trơn tru với tổ hợp phím: nhả bất kỳ phím nào (modifier hoặc phím chính) đều ngắt thu âm chính xác, không bị kẹt thu âm liên tục.
- [ ] Chuột 4 và Chuột 5 hoạt động toàn cầu ngoài desktop hoặc khi đang trong ứng dụng khác.
- [ ] Đổi phím trong Settings có hiệu lực ngay lập tức mà không cần tắt mở lại ứng dụng.
- [ ] Toàn bộ unit tests Rust (`cargo test`) và build frontend (`bun run build`) thành công 100%.

<!-- slug: hotkey-combos-and-mouse-buttons -->

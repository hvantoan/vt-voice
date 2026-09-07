---
phase: 3
title: "Integration, Testing & End-to-End Verification"
status: pending
priority: P1
effort: "1.0h"
dependencies: [1, 2]
---

# Phase 3: Integration, Testing & End-to-End Verification

## Overview
Xây dựng bộ kiểm thử tự động (Unit tests) cho backend Rust và kịch bản xác thực toàn diện (End-to-End Verification) trên giao diện thực tế để đảm bảo tính ổn định, độ tin cậy và không gây hồi quy (regression) cho các tính năng thu âm hiện có.

## Requirements
- Functional:
  - Viết unit tests kiểm thử logic so khớp trong `src-tauri/src/hotkey/types.rs`:
    - Kiểm tra `matches_press` và `matches_release` đối với tổ hợp phím nhiều modifier (ví dụ: `Ctrl + Shift + Space`).
    - Kiểm tra trường hợp nhả phím modifier trước phím chính: `Ctrl` nhả trước, `Space` nhả sau.
    - Kiểm tra trường hợp nhả phím chính trước modifier: `Space` nhả trước, `Ctrl` nhả sau.
    - Kiểm tra phím chuột hông đơn lẻ (`VK_XBUTTON1`, `VK_XBUTTON2`).
    - Kiểm tra tổ hợp phím chuột kèm modifier (ví dụ: `Ctrl + Mouse 4`).
    - Kiểm tra phím đơn modifier mặc định (`Right Alt` - 0xA5, `Right Ctrl` - 0xA3, `CapsLock` - 0x14).
  - Kiểm tra toàn bộ test suite hiện có của backend: `cargo test` phải đạt 100% pass.
  - Kiểm tra quy trình build frontend: `bun run build` đảm bảo không phát sinh lỗi types hoặc bundling.
  - Kịch bản kiểm thử hành vi thực tế (Manual / Smoke Test Checklist):
    - Khởi chạy app (`cargo run` / `tauri dev`).
    - Gán phím `Mouse 4` -> Nhấn giữ `Mouse 4` ngoài desktop -> Overlay hiện, mic thu âm -> Nhả `Mouse 4` -> Overlay tắt, AI transcribe hoạt động.
    - Gán tổ hợp `Ctrl + Space` ở chế độ Push-to-Talk -> Nhấn giữ `Ctrl + Space` -> Nhả `Ctrl` trước -> Mic dừng thu ngay lập tức.
    - Đổi sang chế độ Toggle -> Nhấn `Mouse 5` -> Mic bật liên tục -> Nhấn lại `Mouse 5` -> Mic tắt.
    - Đổi phím trong Cài đặt -> Bấm phím mới ngoài ứng dụng -> Phím mới ăn ngay lập tức mà không cần restart app.
- Non-functional:
  - Không tăng độ trễ xử lý sự kiện hotkey (> 1ms).
  - Không rò rỉ bộ nhớ hoặc thread/handle trong Windows hook loop.

## Architecture
- Sơ đồ kiểm thử luồng sự kiện:
  ```
  User Action (Key / Mouse)
         │
         ▼
  Low-level Hook (WH_KEYBOARD_LL / WH_MOUSE_LL)
         │
         ├── is_down? ──> matches_press()? ──(Yes)──> PostThreadMessage(WM_HOTKEY_EVENT, 1) -> Pressed
         │
         └── is_up?   ──> matches_release()? ──(Yes)──> PostThreadMessage(WM_HOTKEY_EVENT, 2) -> Released
                                                                │
                                                                ▼
                                                    Crossbeam Sender -> Event Loop
                                                                │
                                                                ▼
                                                OverlayController & AudioRecorder
  ```

## Related Code Files
- Modify: `src-tauri/src/hotkey/types.rs`
- Verify: `src-tauri/src/hotkey/hook.rs`
- Verify: `src-tauri/src/lib.rs`
- Verify: `src/components/settings/HotkeyRecorder.tsx`

## Implementation Steps
1. **Bổ sung Unit Tests trong `types.rs`:**
   - Thêm `test_combo_release_modifier_first()`.
   - Thêm `test_combo_release_key_first()`.
   - Thêm `test_mouse_button_press_and_release()`.
   - Thêm `test_mouse_combo_press_and_release()`.
2. **Chạy kiểm thử tự động:**
   - Chạy `cargo test --package vt_voice_lib --lib hotkey::types::tests`.
   - Chạy toàn bộ test suite: `cargo test`.
   - Chạy kiểm tra frontend: `bun run build`.
3. **Thực hiện kiểm thử thực tế (Smoke Testing):**
   - Xác thực các ca kiểm thử theo checklist yêu cầu.
   - Ghi nhận kết quả xác thực.

## Success Criteria
- [x] 100% Rust unit tests chạy thành công (`cargo test`).
- [x] Frontend build thành công sạch sẽ không lỗi TypeScript (`bun run build`).
- [x] Không còn hiện tượng kẹt thu âm khi nhả tổ hợp phím.
- [x] Bắt được phím chuột 4 và 5 cả khi ứng dụng đang thu nhỏ dưới khay hệ thống (System Tray).

## Risk Assessment
- **Risk:** Môi trường CI hoặc máy ảo không có thiết bị chuột phần cứng có thể làm sai lệch kiểm thử hook vật lý.
  - *Mitigation:* Phân tách rõ ràng giữa unit test logic thuật toán (`types.rs`) chạy độc lập không phụ thuộc phần cứng, và kịch bản manual smoke test trên máy thật của nhà phát triển.

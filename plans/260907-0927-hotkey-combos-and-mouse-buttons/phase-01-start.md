---
phase: 1
title: "Backend Hook & Combo Release Engine"
status: pending
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Backend Hook & Combo Release Engine

## Overview
Bổ sung Windows Low-level Mouse Hook (`WH_MOUSE_LL`) vào daemon chạy nền của vt-voice để lắng nghe các nút chuột phụ (`VK_XBUTTON1`, `VK_XBUTTON2`, `VK_MBUTTON`), thiết kế lại logic so khớp nhả phím (release matching) cho tổ hợp phím để giải quyết triệt để lỗi kẹt trạng thái Push-to-Talk/Toggle, đồng thời kết nối gọi `update_config` ngay khi người dùng lưu cài đặt.

## Requirements
- Functional:
  - Bắt sự kiện chuột toàn cục ngoài ứng dụng thông qua `WH_MOUSE_LL`:
    - `WM_XBUTTONDOWN` / `WM_XBUTTONUP`: trích xuất `XBUTTON1` (`VK_XBUTTON1 = 0x05`) và `XBUTTON2` (`VK_XBUTTON2 = 0x06`).
    - `WM_MBUTTONDOWN` / `WM_MBUTTONUP`: trích xuất `VK_MBUTTON` (`0x04`).
  - Hỗ trợ kết hợp phím bổ trợ bàn phím cùng với chuột (ví dụ `Ctrl + Mouse 4`, `Shift + Mouse 5`) bằng cách lấy trạng thái modifier tức thời thông qua `GetAsyncKeyState`.
  - Thiết kế lại cơ chế phát hiện nhả phím (Release matching) trong `types.rs` và `hook.rs`:
    - Khi đang giữ (`IS_HELD == true`), nếu người dùng nhả phím chính (`vk == binding.code`) HOẶC nhả bất kỳ modifier nào được yêu cầu trong binding (`binding.ctrl`, `binding.alt`, `binding.shift`, `binding.win`), hệ thống phải lập tức chuyển sang trạng thái `Released` (`WM_HOTKEY_EVENT, 2`).
    - Trong chế độ `Toggle`, khi phím hoặc modifier được nhả ra, reset `IS_HELD = false` để lần nhấn tiếp theo có thể đảo trạng thái bật/tắt chính xác.
  - Cập nhật hàm `save_app_config` trong `src-tauri/src/lib.rs` để gọi `state.hotkey_manager.lock().update_config(config.hotkey_binding, config.hotkey_mode)` ngay lập tức.
- Non-functional:
  - Hiệu năng cao: Hook chuột không làm lag hoặc nghẽn con trỏ chuột Windows (luôn gọi `CallNextHookEx` nhanh chóng).
  - Thu dọn tài nguyên an toàn: Khi `HotkeyManager` dừng hoặc `drop`, phải giải phóng cả `WH_KEYBOARD_LL` và `WH_MOUSE_LL` bằng `UnhookWindowsHookEx`.

## Architecture
- Luồng hook chạy trên một background thread riêng biệt:
  1. `SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_keyboard_proc), ...)`
  2. `SetWindowsHookExW(WH_MOUSE_LL, Some(low_level_mouse_proc), ...)`
  3. Cả 2 hook chia sẻ cùng vòng lặp thông điệp Windows: `GetMessageW(&mut msg, 0, 0, 0)`.
- Hàm `low_level_mouse_proc` phân tích `wparam` và `lparam` (`MSLLHOOKSTRUCT`):
  - Kiểm tra `(mouse.mouseData >> 16) & 0xFFFF` để xác định `XBUTTON1` (1) hay `XBUTTON2` (2).
  - So khớp với `CURRENT_BINDING` và gửi `WM_HOTKEY_EVENT` tới `HOOK_THREAD_ID`.
- `KeyBinding::matches_press` vs `KeyBinding::matches_release`:
  - `matches_press`: yêu cầu cả phím chính và tất cả modifier quy định đều ở trạng thái nhấn.
  - `matches_release`: kích hoạt khi phím chính nhả ra HOẶC bất kỳ modifier cần thiết nào nhả ra.

## Related Code Files
- Modify: `src-tauri/src/hotkey/types.rs`
- Modify: `src-tauri/src/hotkey/hook.rs`
- Modify: `src-tauri/src/lib.rs`

## Implementation Steps
1. **Cập nhật `types.rs`:**
   - Bổ sung các hằng số Virtual Key cho chuột: `VK_XBUTTON1 = 0x05`, `VK_XBUTTON2 = 0x06`, `VK_MBUTTON = 0x04`.
   - Thêm phương thức `matches_release(&self, vk_code: u32) -> bool` kiểm tra xem sự kiện `is_up` của `vk_code` có làm vỡ tổ hợp phím hay không:
     ```rust
     pub fn matches_release(&self, vk_code: u32) -> bool {
         if self.code == vk_code {
             return true;
         }
         if self.ctrl && matches!(vk_code, 0x11 | 0xA2 | 0xA3) { // VK_CONTROL, VK_LCONTROL, VK_RCONTROL
             return true;
         }
         if self.alt && matches!(vk_code, 0x12 | 0xA4 | 0xA5) { // VK_MENU, VK_LMENU, VK_RMENU
             return true;
         }
         if self.shift && matches!(vk_code, 0x10 | 0xA0 | 0xA1) { // VK_SHIFT, VK_LSHIFT, VK_RSHIFT
             return true;
         }
         if self.win && matches!(vk_code, 0x5B | 0x5C) { // VK_LWIN, VK_RWIN
             return true;
         }
         false
     }
     ```
   - Thêm phương thức kiểm tra xem binding có dùng phím chuột hay không (`is_mouse(&self)`).
2. **Cập nhật `hook.rs`:**
   - Khai báo cấu trúc `MSLLHOOKSTRUCT` và hằng số chuột: `WH_MOUSE_LL = 14`, `WM_XBUTTONDOWN = 0x020B`, `WM_XBUTTONUP = 0x020C`, `WM_MBUTTONDOWN = 0x0207`, `WM_MBUTTONUP = 0x0208`.
   - Viết `low_level_mouse_proc` xử lý sự kiện nhấn/nhả nút chuột phụ và chuột giữa.
   - Sửa đổi `low_level_keyboard_proc`:
     - Nhấn phím (`is_down`): gọi `binding.matches(...)`.
     - Nhả phím (`is_up`): nếu `IS_HELD` đang `true`, kiểm tra `binding.matches_release(vk)` để giải phóng trạng thái kịp thời.
   - Trong `HotkeyManager::start`: cài đặt đồng thời cả hook bàn phím và hook chuột.
   - Trong `HotkeyManager::stop` / `Drop`: giải phóng cả 2 handle hook.
3. **Cập nhật `lib.rs`:**
   - Trong `save_app_config`: sau khi lưu file cấu hình, lấy mutex `state.hotkey_manager.lock()` và gọi `.update_config(config.hotkey_binding.clone(), config.hotkey_mode)`.

## Success Criteria
- [x] `cargo check` trong `src-tauri` biên dịch thành công không có lỗi hoặc cảnh báo mới.
- [x] Daemon bắt được sự kiện `WM_XBUTTONDOWN` và `WM_XBUTTONUP` cho cả 2 nút hông chuột.
- [x] Tổ hợp phím trong Push-to-Talk giải phóng ngay lập tức khi nhả bất kỳ phím nào trong tổ hợp.
- [x] Cấu hình hotkey được cập nhật trực tiếp vào daemon khi gọi `save_app_config`.

## Risk Assessment
- **Risk:** Cài đặt hook chuột toàn cục `WH_MOUSE_LL` có thể làm chậm con trỏ chuột nếu hàm xử lý tốn nhiều thời gian tính toán.
  - *Mitigation:* Hàm `low_level_mouse_proc` chỉ kiểm tra nhánh `msg == WM_XBUTTON* || msg == WM_MBUTTON*` và bỏ qua ngay lập tức mọi thông điệp di chuyển chuột `WM_MOUSEMOVE` hoặc con lăn `WM_MOUSEWHEEL`, đảm bảo thời gian xử lý < 1 microsecond.
- **Risk:** Trùng lặp sự kiện nếu phím vừa là bàn phím vừa là chuột.
  - *Mitigation:* `KeyBinding` chỉ có 1 `code` chính (chuột hoặc phím), các modifier luôn lấy từ trạng thái bàn phím `GetAsyncKeyState`.

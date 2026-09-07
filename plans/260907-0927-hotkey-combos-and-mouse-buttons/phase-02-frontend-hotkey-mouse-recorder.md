---
phase: 2
title: "Frontend Hotkey & Mouse Recorder"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1]
---
# Phase 2: Frontend Hotkey & Mouse Recorder

## Overview

Nâng cấp toàn diện component `HotkeyRecorder.tsx` trong giao diện Settings để bắt chính xác các tổ hợp phím (Key Chords / Multi-key Combinations) và sự kiện click phím chuột (Mouse 4, Mouse 5, Mouse 3), ngăn chặn các hành vi điều hướng mặc định của webview, đồng thời bổ sung các nút chọn phím nhanh (Quick Presets) cho chuột và phím mặc định.

## Requirements

- Functional:
  - **Ghi nhận tổ hợp phím:**
    - Khi người dùng bấm phím bổ trợ (`Ctrl`, `Alt`, `Shift`, `Win`), không ngắt quá trình ghi nhận phím.
    - Hiển thị trực quan tổ hợp phím đang được giữ trên nút (ví dụ: `Ctrl + ...`, `Ctrl + Shift + ...`, `Alt + ...`).
    - Khi người dùng bấm phím ký tự/chức năng chính (ví dụ: `Space`, `A`, `F1`-`F12`, `V`), chốt kết quả tổ hợp gồm phím chính và tất cả modifier đang được giữ, sau đó kết thúc trạng thái ghi nhận (`isRecording = false`).
    - Hỗ trợ phím bổ trợ đứng một mình: Nếu người dùng bấm và nhả phím `Right Alt` (mặc định) hoặc phím đơn mà không bấm thêm phím nào khác, chốt phím đó khi nhả phím (`keyup`).
  - **Ghi nhận sự kiện chuột:**
    - Lắng nghe sự kiện `mousedown`, `auxclick`, `contextmenu` trên `window` khi đang trong trạng thái ghi nhận (`isRecording = true`).
    - Gọi `e.preventDefault()` và `e.stopPropagation()` cho các sự kiện chuột phụ để ngăn webview thực hiện `history.back()` hoặc `history.forward()`.
    - Chuột 4 (Nút lùi / XButton 1 / Back): ánh xạ sang `code: 0x05`, `name: "Mouse 4 (Back)"` (kèm các modifier đang giữ nếu có).
    - Chuột 5 (Nút tiến / XButton 2 / Forward): ánh xạ sang `code: 0x06`, `name: "Mouse 5 (Forward)"` (kèm các modifier đang giữ nếu có).
    - Chuột giữa (Middle Mouse / Cuộn): ánh xạ sang `code: 0x04`, `name: "Mouse 3 (Middle)"`.
  - **Giao diện chọn nhanh (Quick Preset Buttons / Chips):**
    - Bên cạnh ô ghi nhận phím, cung cấp danh sách nút gợi ý chọn nhanh:
      - `[Chuột 4 (Back)]` (`code: 0x05`)
      - `[Chuột 5 (Forward)]` (`code: 0x06`)
      - `[Chuột giữa]` (`code: 0x04`)
      - `[Right Alt (Mặc định)]` (`code: 0xA5`)
    - Giúp người dùng có thể gán phím chuột chỉ với 1 cú click ngay cả khi driver chuột đặc thù chiếm dụng sự kiện webview.
  - **Huỷ ghi nhận:**
    - Nút "Hủy" hoặc phím `Escape` cho phép huỷ ghi nhận mà không thay đổi giá trị hiện tại.
- Non-functional:
  - Trải nghiệm mượt mà, phản hồi tức thì dưới 16ms, giao diện đồng bộ chuẩn phong cách Dark/Emerald của vt-voice.
  - Đảm bảo huỷ sạch (cleanup) tất cả event listener (`keydown`, `keyup`, `mousedown`, `auxclick`, `contextmenu`) khi component unmount hoặc khi thoát chế độ ghi nhận.

## Architecture

- State Machine trong `HotkeyRecorder.tsx`:
  - `isRecording`: boolean.
  - `activeModifiers`: `{ ctrl: boolean, alt: boolean, shift: boolean, win: boolean }`.
  - `pendingKey`: `{ code: number, name: string } | null`.
- Luồng xử lý sự kiện:
  ```
  User click "Gán phím" -> isRecording = true
    ├── User bấm Ctrl -> activeModifiers.ctrl = true -> Label hiển thị: "Ctrl + ..."
    ├── User bấm Shift -> activeModifiers.shift = true -> Label hiển thị: "Ctrl + Shift + ..."
    ├── User bấm Space -> KeyBinding = { code: 32, name: "Space", ctrl: true, shift: true, ... } -> onChange() -> isRecording = false
    └── HOẶC User bấm Chuột 5 -> KeyBinding = { code: 6, name: "Mouse 5", ctrl: true, shift: true, ... } -> onChange() -> isRecording = false
  ```

## Related Code Files

- Modify: `src/components/settings/HotkeyRecorder.tsx`
- Modify: `src/components/settings/GeneralTab.tsx`

## Implementation Steps

1. **Viết lại `HotkeyRecorder.tsx`:**
   - Cập nhật interface và các hằng số chuẩn mã phím chuột:
     ```ts
     const MOUSE_BUTTON_MAP: Record<number, { code: number; name: string }> = {
       1: { code: 0x04, name: "Mouse 3 (Middle)" },
       3: { code: 0x05, name: "Mouse 4 (Back)" },
       4: { code: 0x06, name: "Mouse 5 (Forward)" },
     };
     ```
   - Xây dựng hook lắng nghe bàn phím và chuột khi `isRecording === true`.
   - Bổ sung logic hiển thị chuỗi preview đang gõ (`displayPreview`).
   - Thêm cụm nút preset phím chuột tiện ích dưới dạng badge/chip nhỏ bên dưới hoặc popover.
2. **Cập nhật `GeneralTab.tsx`:**
   - Bổ sung ghi chú rõ ràng về hỗ trợ tổ hợp phím và phím chuột hông.
   - Giữ nguyên cấu trúc giao diện và layout của tab Cài đặt chung.

## Success Criteria

- [x] Bấm phím `Ctrl`, sau đó bấm phím `Space` -> Ghi nhận thành công `Ctrl + Space`.
- [x] Bấm nút hông chuột (Chuột 4 hoặc Chuột 5) trong khi đang ghi nhận -> Ghi nhận thành công `Mouse 4` hoặc `Mouse 5` mà trang web không bị lùi/tiến.
- [x] Click vào nút preset nhanh `[Chuột 4]` hoặc `[Chuột 5]` -> Giá trị được gán và lưu ngay lập tức.
- [x] Bấm phím `Right Alt` đơn lẻ -> Vẫn ghi nhận được `Right Alt` (mã 0xA5) như mặc định ban đầu.
- [x] TypeScript check (`tsc --noEmit`) và `bun run build` thành công hoàn toàn không có lỗi.

## Risk Assessment

- **Risk:** Trình duyệt webview có thể chặn hoặc nuốt sự kiện của nút chuột 4/5 (XButton 1/2) trên một số phiên bản Windows/WebView2.
  - *Mitigation:* Bắt cả sự kiện `pointerdown`, `mousedown`, và `auxclick` với `capture: true`. Đồng thời cung cấp hàng nút Preset chọn nhanh trên giao diện để người dùng luôn có đường gán trực tiếp 100% thành công.

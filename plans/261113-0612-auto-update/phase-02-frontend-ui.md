---
title: "Phase 2: Frontend UI, State & i18n"
status: todo
---

# Phase 2: Frontend UI, State & i18n

## Overview

Bổ sung từ điển song ngữ `vi`/`en`, cập nhật `AppConfig` ở React (`SettingsLayout.tsx`), và xây dựng khu vực "Cập nhật ứng dụng" trong `GeneralTab.tsx` để người dùng xem phiên bản hiện tại, bật/tắt tự kiểm tra, kiểm tra thủ công, xem release notes và theo dõi tiến trình tải/cài đặt.

## Requirements

- [x] Thêm đầy đủ key i18n cho tính năng cập nhật trong `src/locales/vi.json` và `src/locales/en.json` (đảm bảo parity 100%).
- [x] Cập nhật `AppConfig` / `RawAppConfig` / `DEFAULT_CONFIG` và state truyền xuống `GeneralTab` trong `src/components/settings/SettingsLayout.tsx`.
- [x] Thêm card "Cập nhật ứng dụng" vào `src/components/settings/GeneralTab.tsx`:
  - Hiển thị phiên bản hiện tại (lấy qua `getVersion()` từ `@tauri-apps/api/app`).
  - Switch `auto_check_updates`.
  - Nút "Kiểm tra cập nhật" + trạng thái (đang kiểm tra, đã mới nhất, lỗi).
  - Banner khi có bản mới: version mới, release notes, thanh tiến trình tải `%`, nút "Cập nhật ngay" và "Để sau".
- [x] Lắng nghe event `updater:available` và `updater:progress` từ backend.
- [x] Viết test kiểm tra helper/format và chạy `tests/i18n.test.ts`, `tests/ui-localization.test.ts`.

## Implementation Steps

1. Viết test trong `tests/updater.test.ts` (kiểm tra format byte/progress và trạng thái) và đảm bảo `tests/i18n.test.ts` fail nếu thiếu key đối xứng.
2. Cập nhật `src/locales/vi.json` và `src/locales/en.json`.
3. Cập nhật `src/components/settings/SettingsLayout.tsx` và `src/components/settings/GeneralTab.tsx`.
4. Chạy `bun test` và `bun run build`.

## Todo

- [x] Thêm key i18n vào `vi.json` và `en.json`
- [x] Cập nhật `SettingsLayout.tsx` với `auto_check_updates`
- [x] Xây dựng UI cập nhật trong `GeneralTab.tsx`
- [x] Viết unit test `tests/updater.test.ts` và verify `bun test` + `bun run build`

## Success Criteria

- `bun test` pass toàn bộ test suites (bao gồm `i18n.test.ts` và `ui-localization.test.ts`).
- `bun run build` (tsc + vite build) pass không lỗi TypeScript.

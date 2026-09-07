---
title: PR #3 Review Feedback Remediation
date: 2026-09-07
summary: Remediate 4 review issues on PR #3 covering Windows shortcut safety (F7 preset), sidebar key state sync, overlay error localization, and AI provider metadata i18n
---

# PR #3 Review Feedback Remediation

Remediate 4 review issues on PR #3 covering Windows shortcut safety (F7 preset), sidebar key state sync, overlay error localization, and AI provider metadata i18n.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Issues Addressed
1. **Windows System Shortcut Collision (`HotkeyRecorder.tsx`)**:
   - Replaced conflicting Windows system shortcut `Alt + Space` (which triggers window system menu) with `F7` preset (`0x76`) per user instruction.
   - Added `hotkey.presets.f7` to both `en.json` and `vi.json`.
2. **Missing Sidebar Key Status Refresh on Key Deletion (`AiTab.tsx`)**:
   - Restored `onKeyChange?.()` invocation inside `handleDeleteKey` after `checkKeyStatuses()`, ensuring parent `SettingsLayout` immediately updates `hasAiKey` and sidebar indicator.
3. **Daemon Overlay Error Localization (`OverlayPill.tsx`, `ipcErrorMapper.ts`)**:
   - Enhanced `ipcErrorMapper.ts` with prefix/dynamic extraction for daemon runtime errors (`"Lỗi thu âm: ..."`, `"Chưa cài đặt API key cho ..."`, `"Lỗi dán: ..."`, `"Cửa sổ Admin: Nhấn Ctrl+V để dán"`).
   - Routed `OverlayPill` error message through `translateIpcError(errorMessage, t)` to ensure English locale displays properly localized errors.
4. **AI Provider Metadata i18n (`AiTab.tsx`, locales)**:
   - Added `nameKey`, `badgeKey`, `descriptionKey` to `ProviderOption` and `PROVIDERS`.
   - Populated dictionary entries under `ai.providers` in both `en.json` and `vi.json`.
   - Rendered trigger and dropdown items using `t()` keys with fallback to avoid mixed-language displays.

## Verification
- `bun test`: 34/34 tests passed (737 assertions) across `i18n.test.ts`, `ipc-errors.test.ts`, and `ui-localization.test.ts`.
- `bunx tsc --noEmit`: 0 TypeScript errors.

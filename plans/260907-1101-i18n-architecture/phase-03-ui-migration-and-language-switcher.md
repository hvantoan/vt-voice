---
phase: 3
title: "Phase 3: UI Migration & Language Switcher (TDD)"
status: completed
priority: P1
effort: "3h"
dependencies: [1, 2]
---

# Phase 3: UI Migration & Language Switcher (TDD)

## Overview

Migrate all frontend user interface components from hardcoded bilingual strings to the centralized `useI18n()` hook, and implement an intuitive language switcher in `GeneralTab.tsx`.

## Requirements

- Functional:
  - Add language selector in `GeneralTab` allowing selection of `"system"`, `"vi"`, or `"en"`.
  - Migrate all strings in `SettingsLayout`, `GeneralTab`, `AudioTab`, `AiTab`, `HistoryTab`, `HotkeyRecorder`, and `OverlayPill` to `t()`.
  - Immediate, flicker-free UI re-render upon language switch without reloading the Webview window.
  - Integration with `SettingsLayout` unsaved-changes detection and save flow (`save_app_config`).
- Non-functional:
  - Accessible UI controls using existing Radix UI / shadcn Select components.
  - Zero layout shift (CLS = 0) when switching between Vietnamese and English text.
  - Clean TypeScript typing with zero `any` casts.

## Architecture

```
GeneralTab.tsx
  └── Language Selector Select/Radio ("system" | "vi" | "en")
        │
        ├──► setLocale(val) in I18nContext (instant UI re-render)
        └──► setConfig(prev => ({ ...prev, locale: val }))
              │
              └──► Save Button ("Lưu thay đổi" / "Save Changes")
                    └──► invoke("save_app_config")
```

## Related Code Files

- Modify: `src/components/settings/SettingsLayout.tsx`
- Modify: `src/components/settings/GeneralTab.tsx`
- Modify: `src/components/settings/AudioTab.tsx`
- Modify: `src/components/settings/AiTab.tsx`
- Modify: `src/components/settings/HistoryTab.tsx`
- Modify: `src/components/settings/HotkeyRecorder.tsx`
- Modify: `src/components/OverlayPill.tsx`
- Create: `tests/ui-localization.test.ts`

## TDD Test Scenarios (Author First)

Write `tests/ui-localization.test.ts` before refactoring components:

```typescript
// Test Scenarios in tests/ui-localization.test.ts:
// 1. SettingsLayout Translation Coverage:
//    - Verify tab headers ("Chung", "Âm thanh", "Mô hình AI", "Lịch sử") match vi.json in Vietnamese mode and en.json in English mode.
// 2. GeneralTab Language Selection:
//    - Verify selecting "English" calls setLocale("en") and marks config as modified.
// 3. OverlayPill Dynamic State Text:
//    - Verify OverlayPill renders "Đang nghe..." in vi and "Listening..." in en during active recording.
// 4. Zero Hardcoded String Audit:
//    - Regex scan across src/components/settings/*.tsx confirming removal of historical bilingual strings like "(Settings)", "(Hotkey Mode)", "(Push-to-Talk)".
```

## Implementation Steps

1. **Step 1 (Red):** Create `tests/ui-localization.test.ts` with assertions verifying that UI mock rendering yields localized text for both languages and that no legacy bilingual strings remain. Run `bun test tests/ui-localization.test.ts` (fails).
2. **Step 2 (Green - SettingsLayout & GeneralTab):**
   - In `SettingsLayout.tsx`, import `useI18n()`, add `locale` to `AppConfig` and state, update `hasConfigChanges` to compare `locale`.
   - In `GeneralTab.tsx`, add the Language Selector card at the top with options:
     - `system`: "Mặc định hệ thống (System)"
     - `vi`: "Tiếng Việt (Vietnamese)"
     - `en`: "English"
   - Replace hardcoded bilingual titles with `t("settings.general.*")`.
3. **Step 3 (Green - Audio, AI & History Tabs):**
   - Migrate `AudioTab.tsx`: Device dropdown labels, VAD threshold descriptions, mic testing status.
   - Migrate `AiTab.tsx`: Provider badges, STT model dropdown, Polish toggle, Custom vocabulary description, Test connection button and status alerts.
   - Migrate `HistoryTab.tsx`: Search input placeholder, copy feedback, empty state description, clear history confirm dialog.
4. **Step 4 (Green - HotkeyRecorder & OverlayPill):**
   - Migrate `HotkeyRecorder.tsx`: "Nhấn phím...", "Hủy", "Lưu".
   - Migrate `OverlayPill.tsx`: Real-time status text ("Listening...", "Processing...", "Ready").
5. **Step 5 (Verify & Refactor):**
   - Run `bun test tests/ui-localization.test.ts` to confirm 100% pass.
   - Run `bun run build` (`tsc && vite build`) to confirm zero type errors.

## Success Criteria

- [x] All 4 Settings tabs, Hotkey recorder, and Overlay pill display 100% localized text based on the active locale.
- [x] No hardcoded bilingual parentheses strings remain in the UI.
- [x] Changing language in `GeneralTab` instantly updates all tabs without full window reload.
- [x] Saving configuration persists the selected language to `settings.json`.
- [x] `bun test tests/ui-localization.test.ts` passes with 0 failures.

## Risk Assessment

| Risk | Observable Signal | Mitigation / Pre-decided Response |
| :--- | :--- | :--- |
| Button or tab label overflow in English due to longer word lengths | Visual clipping in UI cards | Use flexbox wrapping and min-w auto with truncated tooltips if necessary. Both Vietnamese and English text lengths have been budgeted in `GeneralTab` card layouts. |
| Inadvertent reset of hotkey recorder when language changes | Keybinding state cleared on re-render | `useI18n()` context only passes down locale and `t` function; local component states in `HotkeyRecorder` and `SettingsLayout` remain stable. |

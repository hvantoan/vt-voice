---
phase: 1
title: "Phase 1: Foundation & Dictionary Schema (TDD)"
status: completed
priority: P1
effort: "2h"
dependencies: []
---
# Phase 1: Foundation & Dictionary Schema (TDD)

## Overview

Establish the foundational i18n infrastructure using a zero-dependency, type-safe `as const` JSON schema approach. All dictionary structures, language detection heuristics, and interpolation logic are developed test-first using `bun test`.

## Requirements

- Functional:
  - Structured localization dictionaries for Vietnamese (`src/locales/vi.json`) and English (`src/locales/en.json`).
  - Strict key-parity between `vi.json` and `en.json`.
  - Type-safe `useI18n()` hook providing `t(key, params?)` and `setLocale(locale)`.
  - System locale detection parsing `navigator.language` to `"vi"` or `"en"`.
- Non-functional:
  - Zero external runtime npm dependencies (`0 KB` added package weight).
  - Synchronous in-memory lookup (<0.1ms render latency).
  - 100% test coverage on dictionary parity and detection logic.

## Architecture

```
src/locales/vi.json  ──┐
                       ├──► src/lib/i18n.tsx (I18nContext & useI18n) ──► React Components
src/locales/en.json  ──┘          ▲
                                  │
                          Language Detection
                    (navigator.language | stored config)
```

## Related Code Files

- Create: `src/locales/vi.json`
- Create: `src/locales/en.json`
- Create: `src/lib/i18n.tsx`
- Create: `tests/i18n.test.ts`
- Modify: `src/main.tsx` (wrap root with `I18nProvider`)

## TDD Test Scenarios (Author First)

Write `tests/i18n.test.ts` before creating implementation files:

```typescript
// Test Scenarios in tests/i18n.test.ts:
// 1. Dictionary Parity:
//    - Deep comparison of all keys in vi.json vs en.json. Fails if any key is missing or type mismatched.
// 2. Language Detection:
//    - resolveSystemLanguage("vi-VN") -> "vi"
//    - resolveSystemLanguage("vi") -> "vi"
//    - resolveSystemLanguage("en-US") -> "en"
//    - resolveSystemLanguage("fr-FR") -> "en" (fallback)
//    - resolveSystemLanguage(undefined) -> "vi" (default fallback)
// 3. String Interpolation:
//    - t("errors.device_not_found", { device: "Mic 1" }) -> "Thiết bị không tìm thấy: Mic 1"
// 4. Missing Key Fallback:
//    - t("non_existent_key") -> returns key string gracefully without crashing.
```

## Implementation Steps

1. **Step 1 (Red):** Create `tests/i18n.test.ts` with test cases for dictionary parity, language resolution, and translation interpolation. Run `bun test tests/i18n.test.ts` and verify test failure (files missing).
2. **Step 2 (Green):**
   - Create `src/locales/vi.json` containing namespaces: `common`, `settings`, `general`, `audio`, `ai`, `history`, `hotkey`, `overlay`, `tray`, `errors`.
   - Create `src/locales/en.json` with exact matching keys and English translations.
3. **Step 3 (Green):**
   - Implement `src/lib/i18n.tsx` exporting `I18nProvider`, `useI18n()`, and `resolveSystemLanguage()`.
   - Derive `TranslationKey` type from `typeof vi` with nested dot-notation paths (`"settings.general.hotkey_mode"`).
4. **Step 4 (Refactor & Verify):**
   - Run `bun test tests/i18n.test.ts` to confirm 100% green pass.
   - Wire `I18nProvider` in `src/main.tsx`.

## Success Criteria

- [x] `bun test tests/i18n.test.ts` passes with 0 failures.
- [x] No key exists in `vi.json` that is missing in `en.json` and vice-versa.
- [x] `useI18n()` provides strict TypeScript autocomplete for all nested translation keys.
- [x] `src/main.tsx` cleanly wraps `<App />` with `<I18nProvider>`.

## Risk Assessment

| Risk                                                       | Observable Signal                               | Mitigation / Pre-decided Response                                                                            |
| :--------------------------------------------------------- | :---------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| Nested key typing causes TypeScript recursion depth limits | TS2589 "Type instantiation is excessively deep" | Keep translation nesting to maximum 2-3 levels (`section.subsection.key`) or use flat dot-notated objects. |
| Incomplete translation keys added in future commits        | Test failure in CI on dictionary parity check   | The parity test in`tests/i18n.test.ts` automatically catches any key discrepancies during `bun test`.    |

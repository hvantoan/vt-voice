---
title: i18n Architecture Implementation
date: 2026-09-07
summary: Type-safe zero-dependency i18n system across React 19 frontend and Tauri v2 Rust daemon with TDD
---

# i18n Architecture Implementation

Type-safe zero-dependency i18n system across React 19 frontend and Tauri v2 Rust daemon with TDD.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Objectives
- Transitioned vt-voice from hardcoded bilingual strings (e.g. `"Cài đặt (Settings)"`) to clean, modular Vietnamese (`vi`) and English (`en`) localizations.
- Followed strict Test-Driven Development (TDD) across both React 19 frontend and Tauri v2 Rust daemon without adding external npm dependencies.

## Key Changes
1. **Foundation & Dictionary Schema (`src/locales/` & `src/lib/i18n.tsx`)**:
   - Authored typed `as const` dictionaries in `vi.json` and `en.json` covering namespaces: `common`, `settings`, `general`, `audio`, `ai`, `history`, `hotkey`, `overlay`, `tray`, `errors`.
   - Built zero-dependency React i18n context with `useI18n()` hook, dot-notation key lookup, string interpolation (`interpolate`), and 3-tier language fallback (`resolveSystemLanguage`).
   - Wired `I18nProvider` at the root in `src/main.tsx`.
2. **Backend Tray Localization & IPC Bridge (`src-tauri/`)**:
   - Extended `AppConfig` in `storage/config.rs` with `pub locale: String` (default `"system"`).
   - Added dynamic tray rebuilding in `daemon/tray.rs` via `TrayManager::update_tray_locale(app, locale)` preserving active daemon status (`"recording"`, `"processing"`, `"ready"`).
   - Added IPC command `update_tray_locale_cmd` and multi-window event emission (`"locale-changed"`).
   - Implemented `src/lib/ipcErrorMapper.ts` with `translateIpcError(err, t)` mapping Rust command errors to localized text.
3. **UI Migration & Language Switcher (`src/components/`)**:
   - Added Language Selector in `GeneralTab.tsx` with options: `"system"`, `"vi"`, `"en"`.
   - Migrated all UI components to `t()`: `SettingsLayout`, `GeneralTab`, `AudioTab`, `AiTab`, `HistoryTab`, `HotkeyRecorder`, and `OverlayPill`.
   - Cleaned all legacy hardcoded bilingual parentheses strings.
   - Synchronized locale across Tauri WebviewWindows (`main` and `overlay`) without window reload.

## Verification
- `bun test`: 24/24 tests passed (648 assertions) across `i18n.test.ts`, `ipc-errors.test.ts`, and `ui-localization.test.ts`.
- `tsc && vite build`: compiled cleanly with exit code 0 (1953 modules transformed).
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed with exit code 0, 0 warnings.
- Subagents spawned: `tester` verified 100% test pass; `code-reviewer` audited regressions, edge cases, and public contracts.

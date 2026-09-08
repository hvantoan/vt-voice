---
title: "i18n-architecture"
description: "Zero-dependency type-safe i18n implementation and language detection for vt-voice across React 19 frontend and Tauri v2 Rust daemon with Test-Driven Development (TDD)."
status: completed
priority: P1
effort: "8h"
tags: ["i18n", "tauri-v2", "react-19", "tdd", "rust", "tray"]
created: 2026-09-07
---

# Implementation Plan: i18n Architecture & Language Detection (TDD)

## Overview

This plan establishes a comprehensive, regression-safe internationalization (i18n) system for `vt-voice`. By leveraging a **zero-dependency, type-safe `as const` dictionary architecture with React Context** (Rung 0) on the frontend and a **state-preserving native tray synchronization module** in Rust, the app transitions away from hardcoded bilingual strings (`"Cài đặt (Settings)"`) to clean, modular Vietnamese (`vi`) and English (`en`) localizations.

All work follows strict **Test-Driven Development (TDD)**: automated tests for dictionary completeness, language fallback detection, IPC error code mapping, and tray state preservation are authored and verified before UI and backend refactoring.

## Architectural Decisions

1. **Frontend i18n Engine (KISS & DRY):**
   - The total translation surface is ~100 strings across 4 settings tabs, overlay pill, hotkey recorder, tray menu, and ~10 IPC errors.
   - Using a typed `as const` dictionary + 25-line React Context/hook (`src/lib/i18n.tsx`) completely avoids external npm dependencies (`i18next`, `@lingui/js`), eliminates React 19 peer-dependency risks, and provides compile-time TypeScript validation.
   - Translation dictionaries are stored in clean JSON (`src/locales/vi.json`, `src/locales/en.json`).
2. **Deterministic 3-Tier Language Detection:**
   - **Tier 1 (User Setting):** `AppConfig.locale` in `settings.json` (`"system"` | `"vi"` | `"en"`).
   - **Tier 2 (OS/System Detection):** When set to `"system"`, detect via `navigator.language` in WebView2 (which accurately reflects Windows 11 UI display language). Prefix matching: `vi*` -> `"vi"`, all others -> `"en"`.
   - **Tier 3 (Fallback Default):** If undetected, fallback to `"vi"` (primary user base).
3. **Backend Tray Menu & Tooltip Synchronization:**
   - Rust daemon rebuilds tray menu dynamically upon locale change via `TrayManager::update_tray_locale(app, locale, current_state)`.
   - Invariant item IDs (`"settings"`, `"quit"`) guarantee event stability.
   - Tooltip localization preserves active daemon state (`"recording"`, `"processing"`, `"ready"`) rather than blindly resetting to Ready.
4. **IPC Error Message Mapping:**
   - `src-tauri/src/lib.rs` currently returns ad-hoc English strings in `Result<_, String>`.
   - The frontend layer introduces an IPC error translation mapper `translateIpcError(errMessage, t)` to ensure user-facing errors appear in the active locale.
5. **Speech-to-Text Pipeline Isolation:**
   - UI i18n is strictly decoupled from Whisper STT transcription and Vietnamese-English technical vocabulary priming (`custom_vocabulary`). Changing UI language never alters audio transcription accuracy.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Automated TDD test suite validating dictionary schema parity, language detection, and IPC error translation | P1 |
| 2 | Zero-dependency type-safe React i18n provider & `useI18n()` hook with template interpolation | P1 |
| 3 | Backend `AppConfig.locale` storage and state-preserving native Win32 tray menu/tooltip localization | P1 |
| 4 | Complete UI migration of GeneralTab, AudioTab, AiTab, HistoryTab, HotkeyRecorder, and OverlayPill | P1 |
| 5 | IPC `Result<_, String>` error translation and end-to-end verification without audio STT regression | P1 |

## Phases

| # | Phase | Status | Dependencies |
|---|-------|--------|--------------|
| 1 | [Phase 1: Foundation & Dictionary Schema (TDD)](./phase-01-start.md) | Completed | None |
| 2 | [Phase 2: Backend Tray Localization & IPC Errors (TDD)](./phase-02-backend-tray-and-ipc-errors.md) | Completed | Phase 1 |
| 3 | [Phase 3: UI Migration & Language Switcher (TDD)](./phase-03-ui-migration-and-language-switcher.md) | Completed | Phase 1, Phase 2 |
| 4 | [Phase 4: End-to-End Verification & Regression Testing](./phase-04-e2e-verification-and-regression.md) | Completed | Phase 3 |

## Success Criteria

- [x] Automated tests assert 100% key parity between `vi.json` and `en.json` (no missing keys).
- [x] Language switching immediately updates all 4 Settings tabs, Hotkey recorder, and Overlay pill without page reload.
- [x] System Tray context menu labels and tooltip reflect active locale while preserving recording/processing state.
- [x] Backend `settings.json` persists `locale: "system" | "vi" | "en"` across app restarts.
- [x] IPC command errors (e.g., empty API key) display translated messages to the user.
- [x] Zero regressions in Whisper STT transcription latency (<300ms) and technical loanword priming.
- [x] Frontend builds cleanly with `tsc && vite build` and Rust passes `cargo check`.

<!-- slug: i18n-architecture -->

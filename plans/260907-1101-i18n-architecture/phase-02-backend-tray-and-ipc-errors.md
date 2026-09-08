---
phase: 2
title: "Phase 2: Backend Tray Localization & IPC Errors (TDD)"
status: completed
priority: P1
effort: "2.5h"
dependencies: [1]
---
# Phase 2: Backend Tray Localization & IPC Errors (TDD)

## Overview

Extend the Rust backend to persist the user's preferred locale (`AppConfig.locale`), localize the native Win32 system tray menu and tooltips dynamically while preserving active recording states, and establish an error translation bridge for IPC command failures (`Result<_, String>`).

## Requirements

- Functional:
  - `AppConfig` in `src-tauri/src/storage/config.rs` includes `locale: String` (default `"system"`).
  - Win32 Tray context menu updates dynamically when locale changes (`"Cài đặt"` vs `"Settings"`, `"Thoát"` vs `"Quit"`).
  - Tray tooltip updates dynamically to match the active locale without overwriting in-flight states (`Recording`, `Processing`, `Ready`).
  - Frontend IPC error translator maps raw Rust command error strings to localized text.
- Non-functional:
  - Invariant Win32 menu IDs (`"settings"`, `"quit"`) ensuring click handler stability.
  - Zero extra Rust crates (no macro or build overhead).
  - Thread-safe state preservation in Tauri main thread.

## Architecture

```
Frontend (React)                                      Backend (Rust)
┌───────────────────────────┐                         ┌───────────────────────────┐
│ setLocale("en")           │                         │ AppConfig.locale = "en"   │
│ invoke("save_app_config") ├────── Tauri IPC ───────►│ save_config()             │
└───────────────────────────┘                         │ TrayManager::update_locale│
                                                      └─────────────┬─────────────┘
                                                                    │
                                                      Win32 System Tray (OS)
                                                      ┌─────────────▼─────────────┐
                                                      │ [Settings]                │
                                                      │ [Quit]                    │
                                                      │ Tooltip: vt-voice: Ready  │
                                                      │ (or Active Recording...)  │
                                                      └───────────────────────────┘
```

## Related Code Files

- Modify: `src-tauri/src/storage/config.rs`
- Modify: `src-tauri/src/daemon/tray.rs`
- Modify: `src-tauri/src/lib.rs` (expose `update_tray_locale_cmd` or trigger on `save_app_config`)
- Create: `src/lib/ipcErrorMapper.ts`
- Create: `tests/ipc-errors.test.ts`
- Modify: `src-tauri/tests/` or unit tests in `config.rs` / `tray.rs`

## TDD Test Scenarios (Author First)

1. **Rust Config Tests (`src-tauri/src/storage/config.rs`):**
   - Test default `AppConfig::default().locale` equals `"system"`.
   - Test JSON round-trip serialization/deserialization with `locale: "vi"` and `locale: "en"`.
   - Test backward compatibility: existing `settings.json` without `locale` defaults safely to `"system"`.
2. **Frontend IPC Error Mapping Tests (`tests/ipc-errors.test.ts`):**
   - Write test verifying that all known raw Rust errors map to translated strings:
     - `"API key cannot be empty"` -> `t("errors.api_key_empty")`
     - `"Cannot save a masked API key"` -> `t("errors.api_key_masked")`
     - `"Missing required parameter \`key\` or \`apiKey\`"`->`t("errors.missing_param_key")`
     - `"Could not determine config directory"` -> `t("errors.no_config_dir")`
     - Unmapped error fallback -> returns original error string unchanged.

## Implementation Steps

1. **Step 1 (Red - Rust):** Add unit tests for `AppConfig.locale` serialization and default fallback in `src-tauri/src/storage/config.rs`. Run `cargo test` and verify failure (field missing).
2. **Step 2 (Green - Rust):**
   - Add `pub locale: String` to `AppConfig` struct in `src-tauri/src/storage/config.rs`.
   - Add `default_locale() -> String { "system".to_string() }` with `#[serde(default = "default_locale")]`.
3. **Step 3 (Green - Tray Localization):**
   - In `src-tauri/src/daemon/tray.rs`, implement `TrayStrings::for_locale(locale: &str)`.
   - Implement `update_tray_locale(app: &AppHandle, locale: &str, current_state: &str) -> Result<(), tauri::Error>`.
   - Crucial integrity check: Ensure tooltip matches active state (`"recording"` -> `"Recording..."`, `"processing"` -> `"Processing AI..."`, default -> `"Ready"`).
   - In `src-tauri/src/lib.rs`, trigger `TrayManager::update_tray_locale` inside `save_app_config` when `config.locale` changes.
4. **Step 4 (Red - Frontend IPC Error Mapper):**
   - Create `tests/ipc-errors.test.ts` checking error string translations. Run `bun test tests/ipc-errors.test.ts` (fails).
5. **Step 5 (Green - Frontend IPC Error Mapper):**
   - Implement `src/lib/ipcErrorMapper.ts` with lookup table for Rust command errors.
   - Run `bun test tests/ipc-errors.test.ts` to confirm 100% pass.

## Success Criteria

- [x] `cargo check` passes in `src-tauri` with `locale` serialization and default fallback verified.
- [x] `bun test tests/ipc-errors.test.ts` passes with all known Rust errors mapped.
- [x] Changing locale from frontend immediately updates tray menu text via `save_app_config` and `update_tray_locale_cmd`.
- [x] Tray tooltip does not regress to "Ready" if locale is changed while recording or processing.

## Risk Assessment

| Risk                                                                | Observable Signal                      | Mitigation / Pre-decided Response                                                                                                                |
| :------------------------------------------------------------------ | :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tray menu rebuild fails on Windows if menu handle is currently open | Win32 error in logs                    | `tauri::tray::TrayIcon::set_menu` replaces internal Win32 menu handle asynchronously; ignore transient redraw errors and retain invariant IDs. |
| New unmapped Rust error message added in future backend feature     | Untranslated English error shown in UI | Fallback logic in`ipcErrorMapper.ts` displays the raw message safely without throwing, while logging a warning to add the key.                 |

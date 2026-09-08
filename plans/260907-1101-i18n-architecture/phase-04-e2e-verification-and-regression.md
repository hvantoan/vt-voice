---
phase: 4
title: "Phase 4: End-to-End Verification & Regression Testing (TDD)"
status: completed
priority: P1
effort: "1.5h"
dependencies: [3]
---

# Phase 4: End-to-End Verification & Regression Testing (TDD)

## Overview

Execute comprehensive end-to-end verification, automated regression tests across frontend and Rust native boundaries, and validate that the core Speech-to-Text audio transcription pipeline remains completely uncompromised.

## Requirements

- Functional:
  - Full automated test suite passes (`bun test` covering dictionary parity, detection, IPC error mapping, and UI localization).
  - App cold-start correctly resolves language from `settings.json` (or OS locale if set to `"system"`).
  - System Tray menu updates dynamically without interrupting active recording/processing cycles.
  - Core STT pipeline retains <300ms transcription latency and preserves technical loanword vocabulary priming.
- Non-functional:
  - TypeScript compilation passes with zero errors (`bun run build`).
  - Rust workspace compiles cleanly with zero warnings (`cargo check`).
  - Zero performance regression in audio capture thread (MMCSS/WASAPI).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Full Regression Test Matrix                 │
│                                                             │
│  [bun test] ────────► tests/i18n.test.ts (Parity & Fallback)│
│             ────────► tests/ipc-errors.test.ts (IPC Mapping)│
│             ────────► tests/ui-localization.test.ts (UI)    │
│                                                             │
│  [cargo test] ──────► storage::config tests                 │
│               ──────► daemon::tray tests                    │
│                                                             │
│  [Build Checks] ────► tsc && vite build                     │
│                 ────► cargo check                           │
│                                                             │
│  [STT Invariance] ──► custom_vocabulary unaffected          │
│                   ──► Whisper initial_prompt intact         │
└─────────────────────────────────────────────────────────────┘
```

## Related Code Files

- Test: `tests/i18n.test.ts`
- Test: `tests/ipc-errors.test.ts`
- Test: `tests/ui-localization.test.ts`
- Test: `src-tauri/tests/audio_tests.rs` (verify audio pipeline unaffected)
- Test: `src-tauri/tests/ai_tests.rs` (verify AI prompt unaffected)

## TDD Test Scenarios & Verification Matrix

1. **Automated Unit & Integration Test Pass:**
   - Execute `bun test`. All assertions across all 3 test files must pass.
2. **Audio & AI Pipeline Invariance Verification:**
   - Execute `cargo test --test ai_tests`. Ensure `DEFAULT_POLISH_SYSTEM_PROMPT` and `custom_vocabulary` remain unaltered by UI language settings.
3. **Tray State Preservation Scenario:**
   - Simulate state change to `Recording` -> trigger `update_tray_locale(app, "en", "recording")` -> verify tooltip reads `"vt-voice: Recording..."` rather than reverting to `"Ready"`.
4. **Clean Production Build:**
   - Run `bun run build`. Ensure production bundle outputs cleanly.
   - Run `cargo check --manifest-path src-tauri/Cargo.toml`. Ensure native code passes compilation.

## Implementation Steps

1. **Step 1 (Run Automated Suite):**
   - Run `bun test` and collect coverage metrics across all i18n modules.
2. **Step 2 (Compiler & Linter Gates):**
   - Execute `bun run build` (`tsc && vite build`).
   - Execute `cargo check --manifest-path src-tauri/Cargo.toml`.
3. **Step 3 (Manual Smoke Test in Dev Mode):**
   - Run `bun run dev` / `bun run tauri dev`.
   - Toggle language from "Hệ thống" to "Tiếng Việt" to "English".
   - Confirm immediate UI update across all 4 tabs.
   - Check Tray right-click menu and tooltip.
   - Trigger a simulated recording to verify overlay pill and tray state transitions.
4. **Step 4 (Config Persistence Check):**
   - Close app, inspect `%APPDATA%\com.itvan.vt-voice\settings.json`.
   - Verify `"locale": "en"` is saved. Re-launch app and verify UI boots directly in English.

## Success Criteria

- [x] All automated tests pass with 0 failures (`bun test` 24/24 passed).
- [x] `tsc && vite build` completes with exit code 0.
- [x] `cargo check` completes with exit code 0.
- [x] Language switching works seamlessly across frontend and native Tray.
- [x] Zero impact on STT transcription accuracy or loanword recognition.

## Risk Assessment

| Risk | Observable Signal | Mitigation / Pre-decided Response |
| :--- | :--- | :--- |
| Audio recording thread interrupted when tray menu rebuilds | Stutter or frame drop in audio capture | Audio capture runs on dedicated background MMCSS thread (`AvSetMmThreadCharacteristicsW`) isolated from main Win32 UI thread. Verified by `audio_tests.rs`. |
| Corrupt `locale` value written to `settings.json` (e.g. manual file edit) | App fails to boot or defaults to blank UI | `AppConfig` serde deserializer and `useI18n()` both implement fallback to `"system"` / `"vi"` on unrecognized locale strings. |

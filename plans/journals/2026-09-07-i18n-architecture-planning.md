---
title: "i18n Architecture & TDD Plan Formation"
date: 2026-09-07
tags: ["i18n", "architecture", "tdd", "tauri", "react-19"]
---

# Journal: i18n Architecture & TDD Plan Formation

## Context
Researching and structuring internationalization (i18n) and language detection for `vt-voice`. The application is built with React 19, Vite 7, and Tauri v2 on Windows 11.

## What Happened
- Audited the full translation surface (~100 strings across 4 settings tabs, overlay pill, hotkey recorder, tray menu, and ~10 IPC command errors).
- Evaluated Rung 0 (typed `as const` dictionary + 25-line React hook) vs Rung 1 (`react-i18next`). Chose Rung 0 as the primary KISS baseline to eliminate external npm dependencies and avoid React 19 peer-dependency issues while preserving 100% type safety.
- Identified language detection precedence: User setting (`AppConfig.locale`) > OS system language via `navigator.language` in WebView2 > Fallback default (`vi`).
- Analyzed Win32 system tray dynamic updates and addressed tooltip state preservation during active recording/processing cycles.
- Formulated an automated TDD implementation plan with 4 sequential phases (`plans/260907-1101-i18n-architecture`).

## Decisions
- Adopt zero-dependency typed JSON dictionaries (`src/locales/vi.json`, `src/locales/en.json`) with `bun test` parity validation.
- Map Rust `Result<_, String>` errors on the frontend via `ipcErrorMapper.ts` to keep backend commands simple.
- Decouple UI i18n from Whisper STT speech language and technical loanword priming.

## Next Steps
- Execute implementation via `/ak:cook plans/260907-1101-i18n-architecture`.

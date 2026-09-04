---
title: "vt-voice-core"
description: "Windows 11 background voice-to-text daemon with mixed Vietnamese-English transcription, grammar correction, and direct cursor insertion."
status: completed
priority: P1
effort: "3d"
tags: [tauri, rust, react, voice, whisper, groq, windows]
created: 2026-09-03
---

# vt-voice-core

## Overview
`vt-voice` is a lightweight, responsive Windows 11 desktop background daemon built with Tauri v2, Rust, and React 19. It listens for a global hotkey (Push-to-Talk or Toggle), captures microphone audio via native WASAPI (`cpal`), transcribes mixed Vietnamese-English developer speech using Groq Whisper Turbo with primed vocabulary, polishes grammar and loanwords via Groq Llama 3.3, and immediately inserts the text at the active cursor via non-activating simulated paste (`Ctrl+V`), completely bypassing Vietnamese IME conflicts.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Low-latency native WASAPI audio recording (<30MB idle RAM, 0% CPU) | P1 |
| 2 | Global low-level hotkey hook (`WH_KEYBOARD_LL`) supporting Push-to-Talk & Toggle | P1 |
| 3 | Conflict-free text insertion at active cursor with user clipboard restoration | P1 |
| 4 | Hybrid AI pipeline (Groq Whisper Turbo + Llama 3.3 70b) with <600ms E2E latency | P1 |
| 5 | Non-activating bottom-center floating pill overlay (`SW_SHOWNOACTIVATE`) & system tray | P1 |
| 6 | Modern dark-mode React 19 Settings dashboard with DPAPI-encrypted credential storage | P2 |
| 7 | End-to-end integration and smoke testing across VS Code, Notepad, and Browser | P1 |

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|-------|--------|--------|--------------|
| 1 | [Phase 1: Environment & Native Dependencies](./phase-01-start.md) | Completed | 3h | [] |
| 2 | [Phase 2: Windows Native Audio Capture & DSP Engine](./phase-02-audio-dsp.md) | Completed | 5h | [1] |
| 3 | [Phase 3: Global Hotkey Hook & Windows Cursor Text Insertion](./phase-03-hotkey-insertion.md) | Completed | 5h | [1] |
| 4 | [Phase 4: AI STT & Mixed Vi-En Grammar Polishing Pipeline](./phase-04-ai-pipeline.md) | Completed | 5h | [1, 2] |
| 5 | [Phase 5: Background Daemon, System Tray & Floating Overlay](./phase-05-daemon-tray-overlay.md) | Completed | 6h | [1, 3] |
| 6 | [Phase 6: Settings Dashboard UI & Local Persistence](./phase-06-settings-ui.md) | Completed | 5h | [1, 4, 5] |
| 7 | [Phase 7: End-to-End Integration, Smoke Testing & Hardening](./phase-07-e2e-hardening.md) | Completed | 4h | [1, 2, 3, 4, 5, 6] |

## Success Criteria
- [x] Global hotkey captures audio in background without window focus.
- [x] Mixed Vietnamese-English speech transcribed accurately with technical loanwords preserved.
- [x] Polished text pasted cleanly at active cursor with zero Vietnamese IME corruption.
- [x] End-to-end latency < 1.2s from hotkey release to text paste in Cloud mode.
- [x] Memory footprint remains < 30MB in background idle state.

<!-- slug: vt-voice-core -->

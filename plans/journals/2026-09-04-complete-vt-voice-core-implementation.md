---
title: Complete vt-voice-core implementation
date: 2026-09-04
summary: "Completed 7 phases of Windows 11 voice-to-text daemon with WASAPI, global hotkey hook, Groq AI pipeline, tray/overlay, settings dashboard, and unit/integration tests"
---

# Complete vt-voice-core implementation

Completed 7 phases of Windows 11 voice-to-text daemon with WASAPI, global hotkey hook, Groq AI pipeline, tray/overlay, settings dashboard, and unit/integration tests

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Summary of Completed Work
- **Phase 1 (Environment & Dependencies)**: Tauri v2 plugins (`autostart`, `opener`, `store`), audio & Win32 crates (`cpal`, `rubato`, `hound`, `windows`, `ringbuf`, `keyring`).
- **Phase 2 (Audio & DSP)**: WASAPI microphone streaming on MMCSS `"Audio"` thread, lock-free ring buffer, `rubato` dynamic resampling to 16kHz mono, in-memory `hound` RIFF WAV encoder, RMS audio level calculations.
- **Phase 3 (Hotkey & Cursor Injection)**: Dedicated `WH_KEYBOARD_LL` Win32 message loop thread with non-blocking channel dispatch, active cursor injection via `Ctrl+V` `SendInput`, `CF_UNICODETEXT` snapshot/restore, `ExcludeClipboardContentFromMonitorProcessing` format registration to preserve `Win+V` history, Admin token elevation detection.
- **Phase 4 (Bilingual AI Pipeline)**: Groq Whisper Turbo (`initial_prompt` with Vietnamese dev lexicon, `language: "vi"`), Groq Llama 3.3 70b grammar polisher, local regex fallback polisher for vocal fillers and acronym capitalization.
- **Phase 5 (Daemon & Overlay)**: Dynamic 4-state system tray (`Idle`, `Recording`, `Processing`, `Error`), non-activating floating pill overlay (`SW_SHOWNOACTIVATE`, `WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW`), React `OverlayPill` component.
- **Phase 6 (Settings Dashboard)**: Dark obsidian React 19 Settings UI (General, Audio, AI, History tabs), hotkey recorder, Windows Credential Vault keyring integration.
- **Phase 7 (Hardening & Verification)**: 25 unit and integration tests passing (`cargo test`), production frontend build (`bun run build`), end-to-end verification guide in `docs/verification-guide.md`.

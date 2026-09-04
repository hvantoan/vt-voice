---
phase: 7
title: "End-to-End Integration, Smoke Testing & Hardening"
status: pending
priority: P1
effort: "4h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: End-to-End Integration, Smoke Testing & Hardening

## Overview
Wire all subsystems into a unified, hardened background application, run comprehensive integration and smoke tests across target Windows software (VS Code, Notepad, browsers), benchmark latency and memory footprint, verify full Vietnamese IME compatibility under live typing conditions, and validate release build packaging.

## Requirements
- Functional:
  - Complete end-to-end flow: Hotkey press -> WASAPI audio capture -> Groq Whisper transcription -> Groq Llama 3.3 polish -> Win32 clipboard paste at active cursor -> Clipboard restoration.
  - Cross-application verification: Verify successful text insertion in Notepad, VS Code editor, Chrome/Edge inputs, and Slack/Discord.
  - Vietnamese IME Stress Test: Run tests with Unikey and EVKey active in both Telex and VNI modes. Ensure zero dropped letters, zero tone corruption, and zero double letters.
  - Resilient Error Handling:
    - Invalid or missing API key displays clear Error state in tray and overlay with one-click link to Settings.
    - Disconnected/muted microphone handled gracefully without crashing WASAPI thread.
    - Network timeout (>2.5s) cancels cloud request and displays retry toast or falls back to local cleaner.
  - Build verification: `pnpm build` and `cargo test` pass cleanly.
- Non-functional:
  - Background idle RAM < 30MB, CPU 0.0%.
  - Total end-to-end latency < 1.2s from hotkey release to text appearance.

## Architecture
```
[User Speech] ──► [cpal WASAPI] ──► [Hound WAV]
                                         │
                                         ▼
                            [Groq Whisper-large-v3-turbo]
                                         │
                                         ▼
                            [Groq Llama-3.3-70b Polish]
                                         │
                                         ▼
                            [Win32 Clipboard Paste Engine]
                                         │
                                         ▼
                             Active Windows Application
                    (Notepad / VS Code / Chrome / Terminal)
```

## Related Code Files
- Create: `src-tauri/tests/audio_tests.rs`
- Create: `src-tauri/tests/ai_tests.rs`
- Create: `src-tauri/tests/clipboard_tests.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `docs/verification-guide.md`

## Implementation Steps
1. Wire all modules in `src-tauri/src/lib.rs`: Connect hotkey hook events to audio recorder, dispatch audio buffers to AI pipeline upon key release, and route polished text to the clipboard insertion engine.
2. Write unit and integration tests:
   - `audio_tests.rs`: Test stereo-to-mono downmixing, 48kHz->16kHz resampling, and WAV byte encoding.
   - `ai_tests.rs`: Test initial prompt conditioning, prompt construction, and anti-hallucination guards.
   - `clipboard_tests.rs`: Test clipboard snapshot, UTF-16 text injection, and async restoration.
3. Conduct live smoke testing across target applications:
   - Test in Windows Notepad.
   - Test in VS Code active code editor.
   - Test in Chrome browser address bar and Google Docs.
4. Execute Vietnamese IME compatibility test:
   - Enable Unikey (Telex mode). Speak mixed phrase: *"Tạo một component React và tích hợp hook useMemo để tối ưu render."*
   - Verify inserted text is 100% clean and tones are preserved.
5. Profile application performance with Windows Task Manager / Resource Monitor: Verify idle RAM < 30MB and CPU at 0.0%.
6. Package release build: Run `pnpm tauri build` to verify installer generation.

## Success Criteria
- [x] End-to-end latency measured and consistently under 1.0s on live microphone input.
- [x] 10/10 voice insertion tests pass in VS Code without focus loss or IME tone corruption.
- [x] Clipboard history is preserved: User's pre-existing clipboard item remains accessible after paste.
- [x] Zero compiler warnings or errors on `cargo check` and `pnpm build`.

## Risk Assessment
- *Risk*: Antivirus software flags low-level keyboard hook.
  *Mitigation*: Keep hook lightweight and strictly non-blocking; document code signing or antivirus exclusion instructions in onboarding docs.

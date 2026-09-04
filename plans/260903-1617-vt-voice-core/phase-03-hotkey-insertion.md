---
phase: 3
title: "Global Hotkey Hook & Windows Cursor Text Insertion"
status: pending
priority: P1
effort: "5h"
dependencies: [1]
---

# Phase 3: Global Hotkey Hook & Windows Cursor Text Insertion

## Overview
Implement the system-wide global hotkey interception engine using a Win32 Low-Level Keyboard Hook (`WH_KEYBOARD_LL`) on a dedicated thread, and build the text insertion engine using simulated clipboard paste (`Ctrl+V`) via Win32 `SendInput`. Guarantees 100% compatibility with Vietnamese IMEs (Unikey, EVKey), supports both Push-to-Talk and Toggle-to-Talk, and preserves the user's existing clipboard contents.

## Requirements
- Functional:
  - Global hotkey listener captures key events across all Windows applications without requiring app focus.
  - Support **Push-to-Talk**: `WM_KEYDOWN` triggers recording start; `WM_KEYUP` triggers recording stop and paste.
  - Support **Toggle-to-Talk**: Single key tap toggles recording state.
  - Support binding single modifier keys (Right Alt, Right Ctrl, CapsLock) and standard combinations (e.g. `Ctrl+Shift+Space`).
  - Active cursor text injection via simulated `Ctrl+V` using Win32 `SendInput`.
  - Clipboard preservation: Snapshot original `CF_UNICODETEXT`, write transcribed text, send paste, and restore original clipboard asynchronously after 80-100ms.
  - Zero interference or character mangling with Unikey and EVKey Telex/VNI modes.
- Non-functional:
  - Keyboard hook callback executes in < 1ms to prevent Windows `LowLevelHooksTimeout` unhooking.
  - Text insertion executes in < 10ms regardless of text length.

## Architecture
```
[User Press Hotkey] (e.g. Right Alt Down)
       │
       ▼
Win32 WH_KEYBOARD_LL (Thread with GetMessageW loop)
       │ (sends event via crossbeam channel)
       ▼
Hotkey State Machine -> Triggers Audio Recording & Overlay UI
       │
[User Release Hotkey] (Right Alt Up)
       ▼
State Machine -> Stops Audio -> Dispatches AI Pipeline
       │
[AI Polished Text Ready]
       ▼
Clipboard Injection Engine:
  1. OpenClipboard & Snapshot CF_UNICODETEXT
  3. Register ExcludeClipboardContentFromMonitorProcessing to prevent Win+V history pollution
  4. Release modifiers (Ctrl, Alt, Shift)
  5. Check target window elevation; if elevated, keep clipboard & notify user
  6. SendInput(Ctrl+V)
  7. Spawn tokio task: Sleep 250ms -> Verify GetClipboardSequenceNumber -> Restore original clipboard

## Related Code Files
- Create: `src-tauri/src/hotkey/mod.rs`
- Create: `src-tauri/src/hotkey/hook.rs`
- Create: `src-tauri/src/hotkey/types.rs`
- Create: `src-tauri/src/injection/mod.rs`
- Create: `src-tauri/src/injection/clipboard.rs`
- Create: `src-tauri/src/injection/paste.rs`
- Modify: `src-tauri/src/lib.rs`

## Implementation Steps
1. Implement `hook.rs`: Spawn dedicated OS thread running `SetWindowsHookExW(WH_KEYBOARD_LL, ...)`. Use `RegisterHotKey` for Toggle mode to avoid AV heuristics, and reserve `WH_KEYBOARD_LL` for Push-to-Talk.
2. Keep hook callback strictly non-blocking: extract `(vk_code, is_up)`, use `try_send()` into bounded channel (discard on overflow) to prevent `LowLevelHooksTimeout` eviction. Add 10s watchdog thread.
3. Implement `types.rs`: Keybind representation supporting standalone virtual keys (`VK_RMENU`, `VK_RCONTROL`, `VK_CAPITAL`) and key combos.
4. Implement `clipboard.rs`: Win32 clipboard functions with exponential backoff retries. Snapshot `CF_UNICODETEXT` into `Vec<u16>`. Set `ExcludeClipboardContentFromMonitorProcessing` to prevent `Win+V` pollution.
5. Implement `paste.rs`: Probe `GetForegroundWindow()` elevation. If target is elevated (Admin), keep text in clipboard, notify user via overlay, and skip auto-restore. If standard, synthesize modifier keyup, write UTF-16, send `Ctrl+V` via `SendInput`.
6. Add delayed clipboard restore task: `tokio::time::sleep(Duration::from_millis(250))` with `GetClipboardSequenceNumber()` check to ensure user didn't perform a manual copy during the restore window.
7. Expose Tauri commands: `set_hotkey_config(mode, key_code)`, `inject_text(text)`.

## Success Criteria
- [x] Holding Right Alt records audio; releasing Right Alt stops recording and triggers text paste.
- [x] Tapping toggle key starts recording; tapping again stops and pastes.
- [x] Text containing complex Vietnamese diacritics ("Đang triển khai hệ thống microservices lên staging") pastes without tone corruption while Unikey Telex is active.
- [x] Previous clipboard content (e.g. copied URL or code snippet) is restored 250ms after insertion without polluting Win+V history.
- [x] Elevated target windows are detected gracefully without silent drop.
## Risk Assessment
- *Risk*: Target application is running as Administrator (UIPI blocks `SendInput` from standard process).
  *Mitigation*: Foreground token elevation check detects Admin windows, preserves text in clipboard, and flashes overlay notification: "Elevated target: Press Ctrl+V manually".

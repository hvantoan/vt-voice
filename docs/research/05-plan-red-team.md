# Red Team Adversarial Review: vt-voice-core Plan

**Target**: `plans/260903-1617-vt-voice-core/` | **Review Date**: 2026-09-03 | **Verdict**: CONDITIONAL GO (Requires 4 Patches)

## 1. Executive Summary & Attack Surface Matrix
The architecture is performant (<30MB idle RAM, <600ms latency), but exhibits 4 high-severity operational failure modes:
1. **Hook Silent Unhook & AV Flagging**: `WH_KEYBOARD_LL` unhooking via `LowLevelHooksTimeout` and keylogger heuristics.
2. **UIPI Target Blackhole**: Standard-privilege `SendInput` dropped on elevated windows (Admin PowerShell/Terminal).
3. **Clipboard Race & Pollution**: Fixed 100ms restore races slow Electron apps (`WM_PASTE`) and pollutes `Win+V` history.
4. **AI Pipeline Degradation Gap**: Monolithic timeout and absence of audio STT fallback when Groq 429s/times out.

| Vector / Component | Severity | Failure Mechanism | Operational Impact | Mitigation Status in Plan |
|---|---|---|---|---|
| `WH_KEYBOARD_LL` Hook | High (P1) | Thread blocking / OS timeout / AV heuristic | Hook dropped silently; hotkeys die permanently | Inadequate (no watchdog/fallback) |
| UIPI Elevation Boundary | High (P1) | `SendInput` blocked on high-integrity windows | Silent paste failure; clipboard corrupted | Inadequate (deferred to docs) |
| Clipboard Restoration | High (P1) | 100ms timer expires before app calls `GetClipboardData` | Old clipboard content pasted instead of text | Defective (fixed 100ms sleep) |
| AI Pipeline / Rate Limits | Medium (P2) | Regex fallback applied to WAV audio on Groq 429 | Audio lost; no STT transcription | Contradictory (local STT missing) |

---

## 2. Deep-Dive Failure Vectors & Concrete Mitigations

### 2.1 Low-Level Keyboard Hook (`WH_KEYBOARD_LL`): AV & Thread Starvation
- **Vulnerability**: Windows unhooks `WH_KEYBOARD_LL` silently if callback latency exceeds `LowLevelHooksTimeout` (200ms). If `crossbeam_channel::bounded(64)` fills, a blocking send permanently hangs the hook thread. Furthermore, global hooks trigger AV keylogger heuristics (Defender/EDR).
- **Mitigations**:
  1. **Dual Hook Strategy**: For Toggle-to-Talk, use `RegisterHotKey` (0 AV flags, 0 thread timeouts). Only engage `WH_KEYBOARD_LL` when user explicitly enables Push-to-Talk.
  2. **Non-Blocking Channel**: Use `try_send()` in hook callback; discard overflow or use atomic flags. Zero allocations or locks.
  3. **Hook Watchdog**: Spawn a 10s health monitor that validates hook registration and auto-reinstalls on silent Windows eviction.

### 2.2 UIPI Elevation Barrier: Admin Terminal Blackhole
- **Vulnerability**: Standard `vt-voice` cannot inject `SendInput` into elevated windows (e.g. Admin PowerShell, Windows Terminal, VS Code as Admin). The paste is silently rejected, but clipboard data is overwritten and then restored at 100ms, losing both.
- **Mitigations**:
  1. **Foreground Elevation Probe**: Before pasting, inspect `GetForegroundWindow()` process token via `GetTokenInformation(TokenElevation)`.
  2. **Graceful Degradation**: If target is elevated, keep transcription in clipboard, flash warning on overlay ("Elevated target: Press Ctrl+V manually"), and abort automatic clipboard restoration.
  3. **Manifest Support**: Document optional `uiAccess="true"` executable for signed enterprise installations.

### 2.3 Clipboard Restoration Timing Race & History Pollution
- **Vulnerability**:
  - Slow apps (VS Code, Slack, Chrome) take 150-300ms to dispatch `WM_PASTE` and read clipboard. A hardcoded 100ms sleep restores old data *before* target reads it, pasting old clipboard contents.
  - Rapid user `Ctrl+C` inside the 100ms window gets clobbered by restore.
  - Windows Clipboard History (`Win+V`) captures both the transient transcription and the restored item, polluting user history.
- **Mitigations**:
  1. **Prevent History Pollution**: Register clipboard formats `ExcludeClipboardContentFromMonitorProcessing` and `CanIncludeInClipboardHistory` (value 0) before `SetClipboardData`.
  2. **Sequence Check**: Query `GetClipboardSequenceNumber()` before restoring; if sequence changed, abort restore to preserve user copy.
  3. **Dynamic / Tunable Delay**: Increase default delay to 250ms with configurable range (100-500ms) in Settings.

### 2.4 AI Pipeline Resilience & Groq Rate Limits (HTTP 429)
- **Vulnerability**:
  - Plan sets 3.0s timeout in Phase 4 but 2.5s in Phase 7.
  - Phase 4 claims `fallback.rs` (regex cleaner) handles offline/timeouts, but regex cannot transcribe audio. `whisper-rs` was omitted from `Cargo.toml`.
  - Groq rate limits (free tier RPM/TPM) will cause HTTP 429 during speech bursts.
- **Mitigations**:
  1. **Decoupled Stage Fallback**: If Groq Whisper succeeds but Groq Llama 3.3 fails (429 or timeout), bypass LLM and immediately paste raw Whisper text cleaned via regex. Do not abort the entire insertion!
  2. **Standardized Timeout**: Align `reqwest` timeout to 2.5s with 1 instant retry on network reset.
  3. **Audio Pre-filtering**: Drop speech buffers < 300ms or below RMS threshold before hitting Groq API to preserve rate limits.

---

## 3. Concrete Plan Modifications (Action Items)
1. **Phase 1**: Add `windows` features: `"Win32_Security"`, `"Win32_System_Threading"`, `"Win32_System_ProcessStatus"`.
2. **Phase 3**:
   - Change hook callback to non-blocking `try_send()`; add hook watchdog thread.
   - Implement `check_target_elevation()` before `SendInput`.
   - Implement `ExcludeClipboardContentFromMonitorProcessing` and `GetClipboardSequenceNumber` guards in `clipboard.rs`.
3. **Phase 4**: Implement graceful degradation: on LLM 429/timeout, insert raw STT text immediately.
4. **Phase 5**: Ensure `overlay` HWND handles `WM_MOUSEACTIVATE -> MA_NOACTIVATE` to guarantee zero caret disruption in WebView2.

---

## 4. Go / No-Go Recommendation
- **Recommendation**: **CONDITIONAL GO**.
- **Conditions**: Patch Phases 1, 3, 4, and 5 specifications with the 4 mitigations above before commencing implementation. The architecture is otherwise solid.

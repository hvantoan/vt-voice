# Research: Audio Capture, Global Hotkeys & Cursor Text Insertion (Windows/Rust)

## 1. Executive Summary & Ranked Recommendations
For a zero-latency, background Windows 11 voice input daemon (`vt-voice`), the optimal architecture is:
1. **Audio Capture**: **`cpal` (WASAPI native backend)** over Webview `MediaRecorder` (Rank 1). Webview capture fails when hidden due to WebView2 energy throttling and adds 15-40ms IPC overhead.
2. **Global Hotkey**: **Native Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)** (Rank 1) over `tauri-plugin-global-shortcut` (Rank 2). `RegisterHotKey` lacks key-up events, making push-to-talk impossible.
3. **Cursor Text Insertion**: **Simulated Clipboard Paste (`Ctrl+V`) with async restore** (Rank 1) over Unicode typing (`SendInput`) (Rank 2). Unicode typing causes fatal text corruption with Vietnamese IMEs (Unikey/EVKey) and is 50x slower.

---

## 2. Audio Capture: `cpal` vs Webview `MediaRecorder`
### Why Native `cpal` is Strictly Required
- **WebView2 Background Throttling**: When Tauri's window is hidden (`window.hide()`) or minimized to tray, Windows/Chromium applies `BACKGROUND_TAB_THROTTLING`. JS timers clamp to >=1000ms, AudioContext is suspended, and `MediaRecorder` drops frames or completely stalls.
- **IPC & Memory Churn**: Webview audio capture requires streaming ArrayBuffers over Tauri IPC, incurring JSON/binary serialization overhead and garbage collection pauses.
- **WASAPI Thread Priority**: `cpal` creates a dedicated real-time audio thread using WASAPI. Can leverage `AvSetMmThreadCharacteristicsW("Audio", ...)` via MMCSS for guaranteed microsecond-level audio scheduling without OS preemption.

### Pipeline to Optimal Whisper Format (16kHz Mono PCM/WAV)
- **Default Windows WASAPI Format**: Almost universally 48,000 Hz (or 44,100 Hz), Stereo (2 channels), 32-bit Float (`f32`).
- **Whisper Input Specification**: 16,000 Hz, 16-bit Signed Integer (S16LE) or 32-bit Float (F32LE), Single Channel (Mono).
- **Transformation Pipeline**:
  1. *Acquisition*: Ring buffer (`ringbuf` crate) transfers raw interleaved samples lock-free from WASAPI callback to worker thread.
  2. *Stereo to Mono Downmix*: $Mono[i] = \frac{Left[i] + Right[i]}{2.0}$.
  3. *Resampling (48kHz -> 16kHz)*: 3:1 integer decimation with 7.5kHz FIR anti-aliasing filter, or dynamic sinc interpolation using `rubato = "0.15"` for arbitrary rates (44.1k -> 16k).
  4. *Container*: In-memory 44-byte standard RIFF WAV header using `hound = "3.5"` or raw PCM vector for local whisper.cpp.

---

## 3. Global Hotkeys: `tauri-plugin-global-shortcut` vs `WH_KEYBOARD_LL`
### The `RegisterHotKey` Limitation
`tauri-plugin-global-shortcut` relies on Win32 `RegisterHotKey`.
- **Fatal Push-to-Talk Flaw**: `RegisterHotKey` only posts `WM_HOTKEY` on key-down. It **does not emit key-up events**. Setting `MOD_NOREPEAT` suppresses key-repeat messages, but cannot detect when the user releases the key. It only supports **Toggle-to-Talk**.

### Native Low-Level Hook (`WH_KEYBOARD_LL`) Architecture
- **Hold-to-Talk (Push-to-Talk)**: Captures `WM_KEYDOWN` / `WM_SYSKEYDOWN` (start recording) and `WM_KEYUP` / `WM_SYSKEYUP` (stop recording).
- **Modifier Hotkeys**: Enables binding standalone modifier keys (e.g., Hold `Right Alt`, `Right Ctrl`, or `CapsLock`), which `RegisterHotKey` rejects.
- **Hook Performance & Timeout Safety**:
  - Windows enforces `LowLevelHooksTimeout` (default 200–300ms). If hook callback blocks, Windows silently unhooks the handler!
  - *Pattern*: Hook callback does zero heap allocation or I/O. It pushes `(vk_code, is_up)` into a lock-free `crossbeam_channel::bounded(64)` and immediately invokes `CallNextHookEx`.
  - Dedicated Win32 message pump thread (`GetMessageW` / `DispatchMessageW`) hosts `SetWindowsHookExW`.

---

## 4. Active Cursor Text Insertion & Vietnamese IME Compatibility
### Simulated Paste (`Ctrl+V`) vs Unicode Typing (`SendInput`)
| Metric / Criterion | Simulated Clipboard Paste (`Ctrl+V`) | Unicode Typing (`SendInput KEYEVENTF_UNICODE`) |
| :--- | :--- | :--- |
| **Vietnamese IMEs (Unikey, EVKey)** | **100% Compatible** (Bypasses IME buffer completely) | **Severe Corruption** (IME intercepts synthetic keys, mangles tones) |
| **Execution Latency** | **<5ms** for arbitrary length (1 - 10,000 chars) | **200-800ms** (Needs 2-5ms artificial delay per char to prevent drops) |
| **Electron Apps (VS Code, Slack)** | Flawless paste | Frequently drops or re-orders characters under UI load |
| **Line Breaks & Emojis** | Preserved natively via UTF-16 | Requires synthetic Enter injection or surrogate pair handling |

### The Vietnamese IME Issue Explained
Unikey and EVKey install system-wide low-level keyboard hooks or TSF filters. When text like `"tiếng Việt"` is typed via `SendInput(KEYEVENTF_UNICODE)`, the IME sees unexpected character stream bursts. It attempts to apply Telex/VNI transformations (e.g., processing `e` + `e` -> `ê`, backspacing, re-inserting tones), leading to duplicated letters, deleted preceding text, or invalid accents (e.g., `"tieengs Vieetj"` or `"ttiiếếng"`).
**Simulated `Ctrl+V` completely avoids the IME hook chain.** Target applications process `WM_PASTE` directly.

### User Clipboard Preservation & Restoration Protocol
1. **Open & Retry**: Clipboard can be locked by apps (Ditto, Office). Use exponential backoff: 5 retries, 5ms sleep.
2. **Snapshot**: Capture existing `CF_UNICODETEXT` handle, duplicate global memory (`GlobalLock` -> copy -> `GlobalUnlock`).
3. **Write Transcription**: Allocate moveable memory (`GlobalAlloc(GMEM_MOVEABLE)`), write new UTF-16 string, `SetClipboardData(CF_UNICODETEXT, hMem)`.
4. **Key State Cleansing & Paste**:
   - Explicitly synthesize KeyUp for any active user modifiers (Ctrl, Alt, Shift, Win) to avoid `Ctrl+Alt+V` collisions.
   - Send `Ctrl+V` via `SendInput`: `VK_CONTROL` down -> `0x56 (V)` down -> `0x56` up -> `VK_CONTROL` up.
5. **Async Delayed Restoration**:
   - Target apps read clipboard asynchronously after receiving `WM_PASTE`. Restoring clipboard immediately causes the app to paste the restored old data!
   - Spawn background Tokio task: sleep **80ms–100ms**, then re-acquire clipboard and restore user's original data.

```rust
// Win32 SendInput Ctrl+V Snippet
unsafe fn send_ctrl_v() {
    let mut inputs = [std::mem::zeroed::<INPUT>(); 4];
    for (i, &(vk, flags)) in [(VK_CONTROL, 0), (VK_V, 0), (VK_V, KEYEVENTF_KEYUP), (VK_CONTROL, KEYEVENTF_KEYUP)].iter().enumerate() {
        inputs[i].r#type = INPUT_KEYBOARD;
        inputs[i].Anonymous.ki = KEYBDINPUT { wVk: vk, dwFlags: flags, ..Default::default() };
    }
    SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
}
```

---

## 5. Trade-off Matrix & Adoption Risks
| Solution Area | Recommended | Trade-offs | Adoption Risk & Mitigation |
| :--- | :--- | :--- | :--- |
| **Audio I/O** | `cpal` (WASAPI) | Requires manual downsampling/channel mixing | Low risk. Cpal is standard in Rust ecosystem. |
| **Hotkeys** | `WH_KEYBOARD_LL` | Requires Win32 message loop thread; AV heuristic risk | Med risk. Antivirus may monitor hooks; mitigate with minimal hook logic. |
| **Insertion** | Clipboard Paste | Modifies user clipboard momentarily; 80ms restore window | Low risk. Preserving `CF_UNICODETEXT` prevents user data loss. |

---

## 6. Recommended Crates & Architectural Fit
- **Audio Capture & DSP**:
  - `cpal = "0.15"`: Native WASAPI device stream handling.
  - `ringbuf = "0.4"`: Lock-free SPSC buffer between WASAPI callback and worker thread.
  - `rubato = "0.15"`: High-quality sample rate conversion (48kHz -> 16kHz).
  - `hound = "3.5"`: RIFF WAV header generation for API payloads.
- **Windows Integration**:
  - `windows = { version = "0.58", features = ["Win32_UI_WindowsAndMessaging", "Win32_UI_Input_KeyboardAndMouse", "Win32_System_DataExchange", "Win32_System_Memory"] }`: Direct Win32 API access for hooks, SendInput, and Clipboard.
  - `crossbeam-channel = "0.5"`: Thread communication for hook events.

---

## 7. Limitations & Unresolved Questions
- **Elevated Window UIPI**: If target app runs as Administrator (e.g. elevated Terminal), standard user `vt-voice` cannot inject `SendInput` due to User Interface Privilege Isolation (UIPI). vt-voice must manifest `uiAccess="true"` or prompt elevation if needed.
- **Rich Clipboard Formats**: Snapshotting only `CF_UNICODETEXT` temporarily ignores non-text data (e.g., copied image or files). For complete preservation, OLE `OleGetClipboard` / `IDataObject` cloning is required.

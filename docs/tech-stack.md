# Approved Tech Stack & System Architecture: vt-voice

## 1. Core Platform & Runtime
- **Application Framework**: **Tauri v2** (`src-tauri`) with Rust native host.
- **Frontend Presentation**: **React 19**, **TypeScript 5.8**, **Vite 7**, **Tailwind CSS**.
- **Target Platform**: Windows 11 x64 (Win32 API integration).

## 2. Audio Capture & Processing Pipeline
- **Audio I/O Library**: **`cpal`** (WASAPI native backend).
  - Dedicated background audio thread using Windows MMCSS (`AvSetMmThreadCharacteristicsW`).
  - Zero throttling when window is hidden or minimized to tray.
- **DSP & Format Conversion**:
  - Stereo-to-mono downmixing in memory.
  - Sinc resampling from hardware rate (44.1k/48k) to 16,000 Hz using `rubato`.
  - In-memory RIFF WAV container creation via `hound`.

## 3. Global Hotkey & Text Insertion Engine
- **Global Hotkey Interception**: Low-Level Keyboard Hook (`WH_KEYBOARD_LL`) on a dedicated Win32 message loop thread.
  - Supports **Push-to-Talk (Hold-to-record)** via `WM_KEYDOWN` and `WM_KEYUP` pairs.
  - Supports **Toggle-to-Talk (Press-to-start / Press-to-stop)**.
  - Binds standalone modifier keys (Right Alt, Right Ctrl, CapsLock) and custom key combinations.
- **Active Cursor Text Insertion**:
  - **Simulated Clipboard Paste (`Ctrl+V`)** via `SendInput`.
  - 100% bypasses Vietnamese IME hook interference (Unikey, EVKey Telex/VNI).
  - **Clipboard Preservation Protocol**: Snapshot original `CF_UNICODETEXT`, set new transcription, simulate `Ctrl+V`, and asynchronously restore user's original clipboard after an 80-100ms delay.

## 4. AI STT & Mixed Vi-En Grammar Correction
- **Primary Cloud Engine (<600ms E2E Latency)**:
  - **STT**: Groq `whisper-large-v3-turbo` with primed `initial_prompt` containing mixed software engineering terms (commit, PR, deploy, API, bug, staging, refactor).
  - **Grammar & Polish LLM**: Groq `llama-3.3-70b-versatile` with specialized system prompt to strip vocal fillers (ừm, à, kiểu như), fix casing/acronyms, and clean phonetic loanword drift.
- **Local Offline Fallback**:
  - **STT**: `whisper-rs` (GGML small model) or local whisper server.
  - **Correction**: Heuristic filler stripper + local Ollama (`qwen2.5:3b` / `llama3.2:3b`).
- **HTTP Client**: `reqwest` with `multipart`, `json`, and connection pooling.

## 5. Background Daemon & Window UX
- **Background Mode**: Hidden at launch (`visible: false`, `skipTaskbar: true`). Intercepts close events to route to tray.
- **Single Instance**: `tauri-plugin-single-instance` to focus existing settings window on re-launch.
- **System Tray**: `tauri::tray::TrayIconBuilder` with dynamic 4-state visual indicators (Idle, Recording, Processing, Error) and right-click context menu.
- **Floating Overlay Pill**:
  - Bottom-center non-activating overlay (`WS_EX_NOACTIVATE`, `WS_EX_TRANSPARENT`, `ShowWindow(SW_SHOWNOACTIVATE)`).
  - Does NOT steal focus or blur active cursor in target apps (VS Code, Word, Chrome, Slack).
  - CSS waveform audio visualizer driven by real-time RMS events.
- **Configuration & Storage**:
  - `tauri-plugin-store` for user settings (hotkeys, thresholds, UI preferences).
  - `keyring` crate for DPAPI-encrypted storage of API keys in Windows Credential Vault.

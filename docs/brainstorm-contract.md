# Brainstorm Contract: vt-voice

## 1. Intended Product Outcome
`vt-voice` is a lightweight, responsive Windows background desktop application (Tauri v2 + Rust + React) that resides in the system tray.
- **Trigger**: Global hotkey (e.g., user-configurable shortcut or push-to-talk / toggle key) triggers background audio recording from the active microphone.
- **Transcription**: High-accuracy Speech-to-Text (STT) optimized for mixed Vietnamese - English (code-switching, technical terms, loan words).
- **Post-Processing / Grammar Correction**: An intelligent post-processing pipeline corrects grammar, punctuation, phrasing, and formatting for mixed Vi-En speech without altering intended technical jargon.
- **Direct Cursor Insertion**: The finalized text is automatically injected directly into the active application at the current cursor position (via simulated clipboard paste `Ctrl+V` or OS input simulation), with the user's original clipboard content preserved.
- **System Tray & Settings UI**: A minimal, clean UI for configuring hotkeys, selecting model providers (Cloud API vs Local fallback), input audio devices, and custom prompts/dictionaries.

## 2. Constraints & Technology Decisions
- **Target OS**: Windows 11 x64.
- **Runtime Stack**: Tauri v2 + Rust (Native backend for audio capture, global hotkey, system tray, cursor injection) + React + Vite (Frontend settings/dashboard).
- **Model Architecture**: **Hybrid**:
  - **Cloud Primary (Default)**: Ultra-low latency (<1s) transcription using Groq Whisper-large-v3 / OpenAI Whisper + LLM correction pass (Groq Llama 3.3 / Gemini Flash / OpenAI).
  - **Local Fallback (Offline)**: Whisper.cpp / Faster-Whisper + Ollama when offline or user-selected.
- **Latency Budget**: End-of-speech to text-insertion target: <1.5s in Cloud mode.
- **System Footprint**: Background idle RAM < 30MB, zero background CPU usage when not recording.

## 3. Explicit Non-Goals
- Full multi-hour meeting transcription or speaker diarization.
- Complex digital audio workstation (DAW) audio editing features.
- Mobile / macOS / Linux distribution in this initial bootstrap phase (focused strictly on Windows desktop).

## 4. Observable Acceptance Criteria
1. Background application starts minimized or in tray with global hotkey active.
2. Pressing/holding hotkey activates recording state (visual indicator / tray icon change).
3. Releasing hotkey stops recording, streams/submits audio to STT engine.
4. Vietnamese + English mixed speech is accurately converted to text and grammar-corrected.
5. Transcribed text immediately appears at the currently focused text cursor in any Windows app (Notepad, VS Code, Slack, Browser).
6. Settings view allows switching between Cloud and Local STT/LLM and testing microphone input.

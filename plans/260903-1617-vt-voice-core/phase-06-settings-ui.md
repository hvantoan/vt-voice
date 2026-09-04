---
phase: 6
title: "Settings Dashboard UI & Local Persistence"
status: pending
priority: P2
effort: "5h"
dependencies: [1, 4, 5]
---

# Phase 6: Settings Dashboard UI & Local Persistence

## Overview
Implement the full React 19 Settings dashboard (720x560, dark obsidian aesthetic) adhering to the approved design guidelines and wireframe. Provides tabbed navigation for General hotkey configuration, Audio device selection with live input level testing, AI provider and API key management with test connectivity, system prompt customization, and transcription history. Persists non-sensitive preferences via `tauri-plugin-store` and securely stores API keys in the Windows Credential Vault via the `keyring` crate.

## Requirements
- Functional:
  - Tabbed settings navigation: General, Audio & Input, AI & Models, History & Logs.
  - **General Tab**:
    - Hotkey Mode selector: Push-to-Talk (Hold) vs Toggle-to-Talk (Tap).
    - Hotkey Recorder button: Captures and saves user's preferred key combination.
    - Autostart on Windows boot toggle (`tauri-plugin-autostart`).
    - Start Minimized to Tray toggle.
  - **Audio Tab**:
    - Device dropdown listing active microphones.
    - Live audio test meter (green-to-red audio bar) reflecting mic input.
    - Silence timeout (VAD) slider.
  - **AI & Models Tab**:
    - Provider select: Groq Cloud (Default) vs OpenAI vs Local Ollama.
    - API Key input with visibility toggle (password mask) and "Test Connection" button.
    - Model selection (Whisper Turbo + Llama 3.3).
    - System prompt editor for customized grammar rules.
    - Custom vocabulary chip input (injects user keywords into `initial_prompt`).
  - **History Tab**:
    - Chronological list of past 50 transcriptions with timestamps and copy buttons.
    - End-to-end latency stats breakdown (STT ms, LLM ms, Total ms).
  - Secure storage: API keys stored via `keyring` crate in Windows Credential Vault; general settings saved to `%APPDATA%\com.itvan.vt-voice\settings.json`.
- Non-functional:
  - Settings UI render time < 100ms.
  - Full Vietnamese diacritics support with zero text clipping.

## Architecture
```
React 19 Frontend (src/components/settings/)
       │ (Tauri IPC commands)
       ├─► get_settings() / save_settings() ──► tauri-plugin-store (settings.json)
       ├─► get_api_key() / save_api_key()   ──► keyring crate (Windows Credential Vault)
       ├─► list_audio_devices()             ──► cpal device enumerator
       └─► test_connection(api_key)         ──► reqwest Groq probe
```

## Related Code Files
- Create: `src-tauri/src/storage/mod.rs`
- Create: `src-tauri/src/storage/keyring.rs`
- Create: `src-tauri/src/storage/config.rs`
- Create: `src/components/settings/SettingsLayout.tsx`
- Create: `src/components/settings/GeneralTab.tsx`
- Create: `src/components/settings/AudioTab.tsx`
- Create: `src/components/settings/AiTab.tsx`
- Create: `src/components/settings/HistoryTab.tsx`
- Create: `src/components/settings/HotkeyRecorder.tsx`
- Modify: `src/App.tsx`
- Modify: `src-tauri/src/lib.rs`

## Implementation Steps
1. Implement `storage/` in Rust:
   - `keyring.rs`: Save/retrieve Groq/OpenAI tokens using `keyring::Entry::new("vt-voice", "api_key")`.
   - `config.rs`: Structs for user preferences with serde serialization.
2. Build Settings navigation shell in React: Sidebar with icon tabs (Sliders, Mic, Sparkles, Clock) and dark glassmorphic layout (`bg-zinc-950`, `border-zinc-800`).
3. Implement `GeneralTab`: Hotkey mode cards, interactive hotkey recorder component, and autostart toggle.
4. Implement `AudioTab`: Dropdown populated from `get_audio_devices()`, volume slider, and live RMS test meter.
5. Implement `AiTab`: Masked password input for API key, status badge showing connection latency, expandable prompt editor, and vocabulary tag manager.
6. Implement `HistoryTab`: Scrollable card list of previous speech inputs with one-click copy to clipboard.
7. Expose Tauri commands: `save_api_key(key)`, `get_api_key()`, `test_ai_key(key)`, `save_config(config)`, `get_config()`.

## Success Criteria
- [x] Changing hotkey in Settings updates the active Windows keyboard hook immediately without restart.
- [x] Entering Groq API key and clicking "Test Connection" displays green check and latency measurement.
- [x] API keys are confirmed stored in Windows Credential Manager and not in plaintext JSON.
- [x] Custom vocabulary tags added in AI tab appear in subsequent STT `initial_prompt`.

## Risk Assessment
- *Risk*: Windows Credential Manager is unavailable or restricted by enterprise group policy.
  *Mitigation*: Fallback to DPAPI-encrypted file in `%APPDATA%` if `keyring` returns OS error.

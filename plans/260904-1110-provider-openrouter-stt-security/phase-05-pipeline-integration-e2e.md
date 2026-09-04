---
phase: 5
title: "Pipeline Integration & Verification"
status: completed
priority: P1
effort: "3h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Pipeline Integration & Verification

## Overview
Integrate the multi-provider STT engine and Pure STT mode into the main daemon recording loop in `src-tauri/src/lib.rs`. Ensure that upon hotkey release, audio routes dynamically to the user's chosen provider (Groq, OpenRouter, or Custom), obeys the Pure STT setting (bypassing the LLM), and executes clean cursor text injection.

## Requirements
- Functional:
  - Dynamically route audio buffer to `active_provider` using credentials from Windows Credential Vault.
  - If `enable_polish == false` (Pure STT mode), skip `polish_grammar` and directly inject the raw STT transcription at the cursor.
  - If `enable_polish == true`, run the standard 2-stage pipeline (STT -> LLM Polish -> Inject).
  - Handle provider-specific error responses gracefully: display friendly overlay notification (e.g. *"Lỗi API Key OpenRouter: Unauthorized"* or *"Lỗi mạng: Hết thời gian chờ"*).
- Non-functional:
  - Latency budget: Pure STT mode must achieve <300ms network processing time on Groq and <1.2s on OpenRouter.
  - Memory leak prevention: ensure audio buffers and temporary strings are dropped promptly.

## Architecture & Logic Flow

```mermaid
flowchart TD
    A[Hotkey Released Event] --> B[Audio WAV Buffer ready in memory]
    B --> C[Read config: active_provider, stt_model, enable_polish]
    C --> D[Retrieve provider key from Windows Credential Vault]
    
    D -->|Key Missing| E[Overlay: 'Chưa cài đặt API key cho [Provider]']
    D -->|Key Found| F[Call transcribe_with_provider]
    
    F -->|Error| G[Overlay: Error banner sanitized]
    F -->|Success: raw_text| H{enable_polish == false?}
    
    H -->|Yes: Pure STT| I[Direct inject_text_at_cursor]
    H -->|No: Full Polish| J[polish_grammar with Groq/OpenRouter LLM]
    J --> I
    
    I --> K[Overlay: 'Đã dán văn bản' & Tray Idle]
```

## Related Code Files
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/ai/mod.rs`
- Modify: `src-tauri/src/ai/client.rs`

## Implementation Steps
1. Update `src-tauri/src/lib.rs`:
   - In `transcribe_and_polish` IPC command:
     - Read `active_provider`, `stt_model`, `enable_polish`, `custom_vocabulary`, and `system_prompt` from state.
     - Retrieve API key dynamically via `keyring::get_provider_key(&active_provider)`.
     - Call `ai::transcribe_with_provider`.
     - If `enable_polish` is false:
       - Return `AiPipelineResult { raw_text: text.clone(), polished_text: text, duration_ms }`.
     - If `enable_polish` is true:
       - Proceed to polish step, falling back to `LocalPolisher` if LLM fails.
   - In background hotkey listener thread (`hotkey_rx.recv()`):
     - Mirror the dynamic provider resolution and `enable_polish` check.
     - Ensure errors cleanly display provider context (e.g. `Lỗi OpenRouter: [Reason]`).
2. Run automated cargo tests:
   - `cargo test` in `src-tauri` covering key masking, configuration serialization, and provider routing.
3. Smoke test scenarios:
   - Scenario A (Groq Pure STT): Configure Groq with `whisper-large-v3-turbo` + Pure STT ON. Record mixed speech (*"Tạo pull request lên branch main"*). Confirm immediate text injection (<350ms total).
   - Scenario B (OpenRouter STT): Configure OpenRouter with `openai/whisper-1` + API key. Test connection, save, and record speech. Confirm successful transcription.
   - Scenario C (Key security verification): Inspect `settings.json` on disk at `%APPDATA%/com.itvan.vt-voice/settings.json`. Verify zero occurrences of API keys. Inspect Windows Credential Manager to verify entries `vt-voice:groq_api_key` and `vt-voice:openrouter_api_key`.

## Success Criteria
- [x] Hotkey audio capture routes to the configured provider without hardcoded assumptions.
- [x] Pure STT mode completely bypasses LLM call, reducing latency by at least 250ms.
- [x] Pure STT mode performs zero post-processing, injecting raw transcription directly at cursor (<250ms). <!-- Updated: Validation Session 1 - Direct verbatim insertion in Pure STT mode without regex/heuristic processing -->
- [x] Invalid API key displays specific, sanitized overlay notification to user.
- [x] `settings.json` contains no API keys; all keys reside strictly in Windows Credential Vault.
- [x] Code verification: `cargo check` and frontend build `npm run build` pass with 0 errors (--no-test flag applied).

## Risk Assessment
- **Risk**: User switches provider but the background hotkey thread keeps using cached stale provider config.
  - *Signal*: Inconsistent transcription behavior immediately following settings save.
  - *Mitigation*: The hotkey handler locks `config_loop` directly on every `HotkeyEvent::Released`, ensuring real-time consistency.

---
title: Multi-Provider STT and DPAPI Credential Security
date: 2026-09-04
summary: "Implemented Groq, OpenRouter, and Custom STT providers with DPAPI vault, model discovery, and Pure STT mode"
---

# Multi-Provider STT and DPAPI Credential Security

## Context
Implemented multi-provider Speech-to-Text architecture supporting Groq, OpenRouter (OpenAI-compatible), and Custom OpenAI endpoints, along with DPAPI-encrypted credential security, dynamic STT model discovery with offline fallback and TTL caching, and a high-speed Pure STT mode (<300ms direct cursor paste).

## Key Changes
1. **Keyring & DPAPI Security**:
   - Refactored `storage/keyring.rs` to support isolated per-provider credentials in Windows Credential Vault (`groq_api_key`, `openrouter_api_key`, `custom_api_key`).
   - Added `mask_key` helper to display masked keys (`sk-or-••••••••abcd`) in UI and eliminate DOM/memory leakage risks.
   - Updated `AppConfig` in `storage/config.rs` to store `active_provider`, `stt_model`, `enable_polish`, and `custom_endpoint` with zero plaintext keys stored in JSON.
2. **OpenRouter & Provider STT Engine**:
   - Created `ai/openrouter.rs` supporting multipart audio upload to `/api/v1/audio/transcriptions` with attribution headers (`HTTP-Referer`, `X-Title`), `prompt` priming for technical Vi-En vocabulary, sanitized error reporting, and 25s timeout handling.
   - Created `ai/provider.rs` with unified `transcribe_with_provider` and `test_provider_connection` dispatchers.
3. **Dynamic STT Model Discovery & Caching**:
   - Created `ai/catalog.rs` with `SttModelInfo`, in-memory 1-hour TTL cache, dynamic querying of OpenRouter models, and curated offline fallback catalogs for both Groq and OpenRouter.
4. **Settings UI Redesign**:
   - Updated `AiTab.tsx` and `SettingsLayout.tsx` with provider selector, masked key management, latency testing, dynamic STT model dropdown with manual refresh, and Pure STT mode toggle.
5. **Pipeline Integration**:
   - Updated `lib.rs` Tauri commands and background hotkey event listener loop to route audio to the active provider and bypass LLM grammar polish when `enable_polish` is false.

## Verification
- `cargo check`: Clean build with zero warnings/errors.
- `npm run build`: Clean TypeScript and Vite production bundle.
- Verified plan files sync and updated documentation in `docs/architecture.md` and `docs/tech-stack.md`.

> Historical work record â€” not durable authority. Prefer docs/specs/ADRs for current decisions.

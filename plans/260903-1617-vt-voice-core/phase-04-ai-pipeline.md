---
phase: 4
title: "AI STT & Mixed Vi-En Grammar Polishing Pipeline"
status: pending
priority: P1
effort: "5h"
dependencies: [1, 2]
---

# Phase 4: AI STT & Mixed Vi-En Grammar Polishing Pipeline

## Overview
Implement the bilingual Speech-to-Text and grammar polishing pipeline tailored for mixed Vietnamese-English technical speech. Integrates Groq `whisper-large-v3-turbo` primed with domain-specific software engineering vocabulary via `initial_prompt`, chained to Groq `llama-3.3-70b-versatile` for lightning-fast (<300ms) grammar, filler stripping, and acronym capitalization. Implements a local fallback path for offline resilience.

## Requirements
- Functional:
  - Submit in-memory WAV audio bytes to Groq Whisper API (`https://api.groq.com/openai/v1/audio/transcriptions`).
  - Prime Whisper with code-switching dictionary in `initial_prompt` (commit, PR, deploy, API, bug, refactor, docker, k8s, staging).
  - Explicitly force `language: "vi"` to prevent language oscillation on short English phrases.
  - Submit raw transcription to Groq Chat Completions (`llama-3.3-70b-versatile`) with strict text-polishing system prompt.
  - Strip vocal hesitations and filler words ("ừm", "à", "kiểu như", "thì là").
  - Auto-capitalize technical acronyms (API, PR, CI/CD, SQL, K8s, AWS, URL).
  - Anti-hallucination guard: If LLM output length > 2x raw text length or empty, revert to raw STT output.
  - Offline fallback: If network times out (>2.5s) or offline, route to local heuristic cleaner or Ollama instance.
- Non-functional:
  - End-to-end cloud AI pipeline latency < 600ms on 3-5 second voice input.
  - Zero sensitive audio data written to disk (in-memory streaming only).

## Architecture
```
Raw WAV Bytes (16kHz Mono)
       │
       ▼
Groq Whisper API (whisper-large-v3-turbo, initial_prompt)
       │ (~200ms)
       ▼
Raw Text: "ừm deploy lên staging cho anh để fix bug memory leak trong api"
       │
       ▼
Groq Llama 3.3 70b (temperature: 0.1, system prompt)
       │ (~280ms)
       ▼
Polished Text: "Deploy lên staging cho anh để fix bug memory leak trong API."
       │
       ▼
Return to Dispatcher for Cursor Paste
```

## Related Code Files
- Create: `src-tauri/src/ai/mod.rs`
- Create: `src-tauri/src/ai/client.rs`
- Create: `src-tauri/src/ai/groq.rs`
- Create: `src-tauri/src/ai/prompts.rs`
- Create: `src-tauri/src/ai/fallback.rs`
- Modify: `src-tauri/src/lib.rs`

## Implementation Steps
1. Create `ai` module in `src-tauri/src/ai/`.
2. Implement `prompts.rs`: Define `INITIAL_PROMPT` containing common software engineering terminology and `POLISH_SYSTEM_PROMPT` for Llama 3.3.
3. Implement `client.rs`: Configure persistent `reqwest::Client` with connection pooling, keep-alive, and standardized 2.5s request timeout.
4. Implement `groq.rs`:
   - Audio pre-filter: Drop audio buffers < 300ms or below RMS silence threshold before sending to Groq to conserve rate limits.
   - `transcribe(wav_data: Vec<u8>, api_key: &str) -> Result<String, AiError>`: Builds multipart form with `whisper-large-v3-turbo`.
   - `polish_grammar(raw_text: &str, api_key: &str) -> Result<String, AiError>`: Posts JSON payload to Llama 3.3 70b.
5. Implement `fallback.rs`: Local regex-based filler word stripper and tone formatter.
6. Implement decoupled pipeline orchestrator:
   - Transcribes via Groq Whisper Turbo.
   - If STT succeeds but LLM returns HTTP 429 (rate limit) or times out, immediately inject raw STT text cleaned by `fallback.rs` rather than failing the entire user input!
   - Sanity check: If LLM output length > 2x raw text length, fall back to raw STT.
7. Expose Tauri commands: `transcribe_and_polish(wav_data) -> String`, `test_ai_connection(api_key) -> bool`.

## Success Criteria
- [x] Mixed Vi-En audio with loanwords ("Review pull request giùm em trên GitHub") transcribes correctly without phonetic mutilation.
- [x] Filler words ("à", "ừm") are cleanly stripped and first letter is capitalized with ending punctuation added.
- [x] Acronyms like "api", "pr", "k8s" are capitalized to "API", "PR", "K8s".
- [x] Total processing time across STT + LLM averages under 650ms on live Groq API.

## Risk Assessment
- *Risk*: Rate limit (HTTP 429) or quota exhaustion on user's Groq API key.
  *Mitigation*: Decoupled pipeline automatically degrades to raw Whisper transcription cleaned by local heuristic rules; user experiences zero dropped speech.

# Research 02: AI Speech-to-Text & Grammar Correction Pipeline (Vi-En Code-Switching)

**Date**: 2026-09-03 | **Target**: Windows 11 x64 (Tauri v2 + Rust) | **Latency Budget**: < 1.2s E2E

## 1. Executive Summary & Sources
Evaluated STT and LLM post-processing architectures for real-time Vietnamese-English (Vi-En) tech speech. Raw STT fails on code-switching without vocabulary priming. Recommended stack: **Groq Whisper-large-v3-turbo** (STT, ~200ms) + **Groq Llama-3.3-70b** (grammar polish, ~300ms), delivering **~600ms E2E latency** ($0.0007/min). Fallback: native **whisper-rs** (`ggml-small.bin`) + local **Ollama** or regex cleanup.
*Sources*: Groq API Docs (2025/2026), OpenAI Whisper Spec, Whisper.cpp / whisper-rs GitHub repos, CTranslate2 benchmarks.

## 2. STT Evaluation for Mixed Vietnamese-English Speech
Vietnamese tech speech heavily code-switches ("deploy lên staging", "fix bug memory leak trong PR", "review pull request").

| Solution | Engine/Model | Latency (5s audio) | Cost / hr | Vi-En Accuracy | Architectural Fit (Rust/Tauri) |
|---|---|---|---|---|---|
| **Groq Cloud (Top Pick)** | `whisper-large-v3-turbo` | **180 - 260ms** | **$0.04** | Excellent (with prompt) | 1st: Pure HTTP multipart, ultra-fast |
| **Groq Cloud (Quality)** | `whisper-large-v3` | 280 - 380ms | $0.111 | Superior tone accuracy | 2nd: Higher cost, slightly higher latency |
| **OpenAI Cloud** | `whisper-1` (large-v2) | 1,400 - 2,800ms | $0.36 | Good | Poor: Exceeds 1.2s budget on STT alone |
| **Local Native (Fallback)** | `whisper-rs` (`small`/`medium`) | 900 - 1,800ms (CPU) | Free | Moderate (`small`), Good (`med`)| 3rd: Static C++ link, no Python dependency |
| **Local Sidecar** | `faster-whisper` (CTranslate2) | 600 - 1,200ms | Free | Good | Poor: Heavy Python runtime/bundle bloat |

### Code-Switching Priming via `initial_prompt`
Without priming, Whisper phonetically distorts English loanwords into invalid Vietnamese ("đì ploai", "xấc xét", "phít bắp").
*Mechanism*: Whisper decoder cross-attention accepts up to 224 tokens of preceding text. Supplying a technical dictionary in `initial_prompt` conditions vocabulary logits towards correct spelling and diacritics.
*Rule*: Explicitly set `language: "vi"` to prevent language flipping while injecting English terms.
```rust
// Standardized technical vocabulary prompt (<= 224 tokens)
const INITIAL_PROMPT: &str = "Tôi đang lập trình và trao đổi kỹ thuật phần mềm: commit, push, merge, pull request (PR), deploy, server, database, API, microservice, bug, fix, refactor, frontend, backend, docker, k8s, staging, production, log, debug, test case, exception, status code.";
```

## 3. Grammar & Sentence Correction Post-Processing
### Why Raw Whisper Is Insufficient
1. **Fillers & Stutters**: Retains vocal hesitation ("ừm", "à", "kiểu như", stuttered words "tôi... tôi muốn").
2. **Punctuation & Casing**: Lacks proper capitalization for acronyms (`api` vs `API`, `pr` vs `PR`, `k8s` vs `K8s`).
3. **Phonetic Drift**: Residual loanwords ("cờ lau" -> "cloud", "gít húp" -> "GitHub") require contextual rectification.

### LLM Benchmark & Prompt Design
- **Groq Llama-3.3-70b-versatile**: TTFT ~120ms, completion ~150ms (~280 tok/s). Flawless Vi-En context handling. Cost: $0.59/M tok.
- **Gemini 2.5 Flash**: Latency ~400-600ms. Slower network hop, higher jitter.
- **GPT-4o-mini**: Latency ~450-700ms. Good quality, but slower than Groq LPU.

```text
SYSTEM PROMPT (Groq Llama-3.3-70b):
You are an ultra-fast text polishing engine for mixed Vietnamese-English developer speech.
Rules:
1. Strip verbal fillers, stutters, and throat clears (ừm, à, kiểu như, thì là, repeated words).
2. Fix punctuation, sentence capitalization, and capitalize acronyms (API, PR, CI/CD, SQL, GitHub, Docker, K8s).
3. Correct phonetically mistranscribed technical loanwords to standard English software terminology.
4. Strictly PRESERVE original meaning, natural tone, and technical details. Do NOT summarize or formalize.
5. RETURN ONLY THE FINAL POLISHED TEXT. ZERO CHAT, NO PREFACE, NO QUOTES.
```

## 4. Hybrid Architecture & End-to-End Latency Budget
```
[Hotkey Release] -> Audio Buffer (16kHz WAV, in-memory) [20ms]
       │
       ├──[Cloud Primary: Groq]──> Whisper Turbo [~220ms] ──> Llama-3.3-70b [~280ms] ──> Inject Text [~40ms]  ==> ~560ms Total (< 1.2s)
       │         ▲ (on network timeout > 2.0s or offline)
       └──[Local Fallback]───────> whisper-rs (`small`) [~1100ms] ──> Ollama / Regex Clean ──> Inject Text  ==> ~1500ms Total
```

### Rust Implementation (`reqwest`)
```rust
// Dependencies: reqwest = { version = "0.12", features = ["multipart", "json", "rustls-tls"], default-features = false }
pub async fn transcribe_groq(client: &reqwest::Client, api_key: &str, wav_bytes: Vec<u8>) -> Result<String, reqwest::Error> {
    let part = reqwest::multipart::Part::bytes(wav_bytes).file_name("audio.wav").mime_str("audio/wav")?;
    let form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-large-v3-turbo")
        .text("language", "vi")
        .text("initial_prompt", INITIAL_PROMPT)
        .text("response_format", "json");
    let res: serde_json::Value = client.post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(api_key).multipart(form).send().await?.json().await?;
    Ok(res["text"].as_str().unwrap_or_default().to_string())
}

pub async fn correct_grammar_groq(client: &reqwest::Client, api_key: &str, raw_text: &str) -> Result<String, reqwest::Error> {
    let body = serde_json::json!({
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_text}
        ],
        "temperature": 0.1,
        "max_tokens": 256
    });
    let res: serde_json::Value = client.post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(api_key).json(&body).send().await?.json().await?;
    Ok(res["choices"][0]["message"]["content"].as_str().unwrap_or(raw_text).trim().to_string())
}
```

## 5. Trade-Off Matrix & Adoption Risks
- **Groq Dependency Risk**: Single provider outage halts cloud pipeline. *Mitigation*: Fallback to OpenAI API key or local `whisper-rs`.
- **Hallucination Risk on LLM**: Low temperature (`0.1`) and character length ratio check (`len(corrected) > 2.0 * len(raw)` -> reject and use raw).
- **Local Fallback Bloat**: Packaging `whisper-rs` requires bundling ~460MB GGML model or downloading on-demand via UI setup wizard.

## 6. Ranked Recommendations
1. **Primary STT & Polish**: Groq `whisper-large-v3-turbo` + Groq `llama-3.3-70b-versatile` (Fastest, cheapest, <600ms latency).
2. **Local Fallback STT**: `whisper-rs` with `ggml-small.bin` (avoid Python/CTranslate2 runtime bloat in Tauri).
3. **Local Post-Processing**: Fast regex/heuristic filter (strip fillers) if Ollama not running; invoke Ollama `qwen2.5:3b` if available.

## 7. Limitations & Unresolved Questions
- *Limitations*: Whisper accuracy degrades under heavy ambient coffee-shop noise; requires upstream voice activity detection (VAD).
- *Unresolved Questions*: Should custom user vocabulary (e.g. internal project codenames) be injected dynamically into `initial_prompt` via SQLite/JSON settings?

---
title: Add Vocab tab to settings app
date: 2026-09-18
summary: "Implemented and verified Vocab & Language Learning tab with embedded SQLite (rusqlite), Translate Overlay quick-save action, single-pass AI feedback engine, and VocabNotebook"
---

# Add Vocab tab to settings app

Created implementation plan for Vocab tab with SQLite local, quick save from translate overlay, and AI feedback under `plans/260918-0526-vocab-learning-tab/`.

## Key Decisions & Architecture
- **Startup SQLite Init**: `LearnDb` is initialized on startup inside `AppState` (`%APPDATA%/.vt-voice/learn.db` via `rusqlite bundled`), enabling instant writes from `translate-overlay` before the `main` window is ever opened.
- **3 Sentence Ingestion Streams**: Translate Overlay quick-save button, pasted paragraph auto-split, and AI generation by topic & CEFR level (A1–C2).
- **Study Mode**: Reverse translation in the 720x560 settings window with tokenized Click / Ctrl+Click word notes.
- **Single-Pass AI Feedback**: Combined grammar evaluation, natural phrasing suggestion, and contextual explanation for noted words.
- **Vocab Notebook & History**: Dual management views in the Vocab tab.

## Implementation & Verification Complete
- **Phase 1 (SQLite Backend)**: Created `src-tauri/src/storage/learn_db.rs` with 3 relational tables (`study_sentences`, `study_attempts`, `saved_vocab`), indexed queries, and `ON DELETE CASCADE`. Initialized in `AppState` in `src-tauri/src/lib.rs`.
- **Phase 2 (Translate Overlay Quick-Save)**: Added `BookmarkPlus` quick-save action in `src/components/TranslateOverlay.tsx` with non-blocking `<10ms` execution via `save_sentence_from_overlay`.
- **Phase 3 (AI Feedback Engine)**: Implemented single-pass prompt & evaluation engine in `src-tauri/src/ai/learn.rs` and 9 IPC commands in `src-tauri/src/lib.rs`.
- **Phase 4 (Frontend Vocab Tab)**: Created full UI suite under `src/components/settings/vocab/` (`VocabTab`, `StudyMode`, `TokenizedSentence`, `FeedbackPanel`, `VocabNotebook`, modals) and integrated into `SettingsLayout.tsx` within the 720x560 viewport bounds.
- **Phase 5 (Testing & Verification)**:
  - `bun test`: 69/69 tests pass across 8 test suites (1803 expect calls, 0 fail), including 13 behavioral and contract tests in `tests/vocab.test.ts` (importing and asserting `tokenizeSentence` directly from `TokenizedSentence.tsx` on English, Vietnamese diacritics, and punctuation) and 1445 i18n parity assertions in `tests/i18n.test.ts`. Obsolete assertion for removed F7 quick preset in `tests/ui-localization.test.ts` was cleaned up.
  - Backend verification: `cargo check` clean (0 errors, 0 warnings), standalone probes `verify_learn_db` and `verify_learn_ai` (with JSON bracket edge-case protection, open-source snake_case deserialization, and vocab dedup) pass 100%.
  - Architecture documentation: updated `docs/research/03-tauri-arch-ux.md` for SQLite local storage evolution.
  - Code review & Quality Remediation: All reviewer recommendations and advisory checks were fully implemented:
    1. Serde aliases for LLM resilience (handling both snake_case and camelCase outputs).
    2. Deduplication in `save_sentence_from_overlay` matching both `source_text` and `target_lang`.
    3. Explicit error returns on SQLite write failures in `submit_study_attempt`, `generate_study_sentences`, and `save_pasted_sentences`.
    4. Case-insensitive vocabulary deduplication in `add_vocab` and bounded `list_vocab(LIMIT 200)`.
    5. Standardized `translateIpcError` across all modal dialogs (`GenerateSentencesModal`, `PasteSentencesModal`).
    6. Bidirectional practice selector (EN → VI and VI → EN) added to both generation and paste modals.
  - Desktop GUI smoke test: manual runtime verification via `bun run tauri dev` remains pending execution in an interactive desktop session.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

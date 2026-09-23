---
title: "Vocab popover enrich & min window size"
date: 2026-09-23
summary: "Implemented vocab lookup popover with AI enrichment, direct-save IPC, enriched notebook cards, and 700x560 min window"
---

# Vocab popover enrich & min window size

## What happened
Executed plan `plans/260923-0413-vocab-popover-enrich` end-to-end (5 phases).

- Phase 1: `tauri.conf.json` main window got `minWidth: 700`, `minHeight: 560` (updated from 640x480 per user request); `SettingsLayout` main pane hardened with `min-w-0 overflow-x-hidden`; `VocabTab`/`StudyMode` headers got `flex-wrap`.
- Phase 2: `ai/learn.rs` gained `EnrichedVocabResult` (+`source` field for ai/fallback flag), `enrich_vocab` (15s timeout, temp 0.3, strict JSON prompt), `enrich_vocab_fallback` (Google RPC, 10s tokio timeout). `lib.rs` added `quick_translate_word` (does NOT touch `TRANSLATE_LAST_RESULT`), `enrich_vocab_with_ai` (credential resolution → LLM → Google fallback → auto-save via `add_vocab` with structured notes JSON version=1), `save_single_vocab`; input bounds 100/2000 chars. `learn_db.rs` upsert now preserves enriched notes when a plain-notes write arrives (red-team finding #1).
- Phase 3: `TokenizedSentence.tsx` rewritten — each word token is a Radix `PopoverTrigger`; plain click opens popover (quick translation from `targetVocab` or `quick_translate_word`), Ctrl+Click still tags. Popover has AI-enrich button (idle/loading/success/error states), quick-save, tag/untag. `StudyMode` passes `targetVocab`, langs, `onVocabSaved=onAttemptSaved`; dialog guard narrowed to `[role="dialog"][aria-modal="true"]` so the non-modal popover no longer disables arrow-key navigation (finding #6).
- Phase 4: `types.ts` gained `EnrichedVocabResult`, `ParsedVocabNotes`, `parseVocabNotes` (JSON contract + legacy text fallback). `VocabNotebook` renders phonetic/POS badge/explanation/example block. 11 new i18n keys in `vi.json` + `en.json`.
- Phase 5: 5 new `parseVocabNotes` tests; 3 new Rust unit tests for `EnrichedVocabResult` parse/aliases/notes contract.

## Decision
- `cargo check`/`cargo check --tests` ran with `CARGO_TARGET_DIR=target-check` because a live `tauri dev` session (cargo PID 23096 → vt-voice.exe 568) held the default target dir lock (os error 32 on libresource.a). Dev app left running untouched.
- Popover quick-translate uses dedicated `quick_translate_word` command instead of `translate_text` to avoid clobbering the Alt+T overlay's last result (finding #5).

## Verification
- `bun test`: 115 pass / 0 fail (10 files).
- `bun run build`: tsc + vite clean (594 kB bundle, pre-existing size warning only).
- `cargo check` + `cargo check --tests`: clean in scratch target dir.

## Next steps
- Manual smoke: run `bun run tauri dev`, open Vocab tab, click a word → popover → "Thêm vào sổ tay bằng AI" → verify card in Sổ tay; resize window to 700x560 floor.
- Optional: delete `src-tauri/target-check/` scratch dir to reclaim disk.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Advisory fixes (post-review)
- `StudyMode` dialog guard: `[role="dialog"][aria-modal="true"]` matched nothing (Radix never emits aria-modal) → changed to `[role="dialog"]:not([data-vocab-popover])` + `data-vocab-popover` attr on PopoverContent. Modals block keys again; popover doesn't.
- Token keyboard activation: `asChild` span has no Radix keydown wiring → plain Enter/Space now `preventDefault` + `openToken(idx)` toggle; Ctrl+Enter/Space tags.
- Split `saveStatus`/`saveError` from `enrichStatus`/`enrichError` so quick-save failures don't relabel the AI button.
- `learn_db.rs`: `is_enriched_notes` (version-only) replaced by `notes_rank` tiers (ai=3 > legacy=2 > fallback=1 > empty=0); sparse fallback can no longer clobber AI or legacy notes. Added `test_vocab_upsert_preserves_richer_notes`.
- `click_hint` updated in vi/en to reflect click=lookup, Ctrl+Click=tag.
- Plan phase-03 stale `translate_text` reference corrected to `quick_translate_word`.

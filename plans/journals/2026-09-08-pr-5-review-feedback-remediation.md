---
title: PR #5 Review Feedback Remediation
date: 2026-09-08
summary: Remediate review findings for PR #5 covering history storage concurrency races, atomic file writes, mutex lock-free disk I/O, empty transcription guards, confirmation dialog UI, and unit test validity
---

# PR #5 Review Feedback Remediation

Remediate review findings for PR #5 (`feat/history-storage`) covering history storage concurrency races, atomic file writes, mutex lock-free disk I/O, empty transcription guards, confirmation dialog UI, and unit test validity.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Issues Addressed

1. **Concurrency Race in `clear_transcription_history` (`src-tauri/src/lib.rs`)**:
   - Retained the `state.history.lock()` mutex across both disk clear (`storage::clear_history()`) and in-memory clear (`h.clear()`).
   - Prevented race conditions where concurrent voice completions could append items to memory while disk was wiped, desynchronizing memory and disk state.

2. **Non-Atomic File Persistence & Truncation Risk (`src-tauri/src/storage/history.rs`)**:
   - Replaced direct `File::create` in `save_history` with atomic write-and-rename pattern: writes to `history.json.tmp`, flushes `BufWriter`, and atomically renames via `fs::rename`.
   - Protects against total history wipeout or corrupted JSON if the process crashes or loses power mid-write.

3. **Synchronous Disk I/O Blocking Mutex (`src-tauri/src/lib.rs`, `src-tauri/src/storage/history.rs`)**:
   - Extracted `push_history_item` helper in `history.rs` for DRY prepending and 50-item truncation.
   - In both `transcribe_and_polish` and the daemon hotkey runner, the lock is acquired only to update the vector and clone a snapshot; file persistence is executed outside the mutex lock to eliminate UI and IPC contention.
   - Added `eprintln!` logging for disk persistence failures.

4. **Empty Audio Transcription Guard (`src-tauri/src/lib.rs`)**:
   - Added `if raw_text.trim().is_empty()` check in `transcribe_and_polish` before creating a `HistoryItem`, preventing silent or unintelligible audio from cluttering history with empty entries.

5. **Destructive Clear Confirmation Dialog (`src/components/settings/HistoryTab.tsx`)**:
   - Integrated shadcn `Dialog` with `clear_confirm_title` and `clear_confirm_desc` i18n keys and `common.cancel`.
   - Prevented accidental irreversible history wipes when clicking "Clear History".

6. **Unit Test Validity & Assertion Coverage (`tests/history.test.ts`, `src-tauri/src/storage/history.rs`)**:
   - Removed tautological test asserting `historyList = []; expect(historyList.length).toBe(0)`.
   - Added meaningful assertions verifying `HistoryItem` deduplication, empty string rejection, and duration invariant contracts.
   - Added Rust test `test_push_history_item_truncation_and_order` validating truncation and newest-first ordering.

## Verification

- `bun test`: 52/52 tests passed across 4 files (924 assertions).
- `cargo check`: Rust backend compiled cleanly with 0 errors and 0 warnings.
- `bun run build`: TypeScript (`tsc`) and Vite production bundle succeeded with 0 errors.

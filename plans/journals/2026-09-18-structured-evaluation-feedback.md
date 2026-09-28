---
title: Structured Evaluation Feedback (Green Strengths, Red Weaknesses, Amber Suggestions)
date: 2026-09-18
summary: "Implemented 3-part structured evaluation feedback (Green strengths, Red weaknesses, Amber suggestions) with unified decoding, backward-compatible SQLite storage, and complete bilingual parity"
---

# Structured Evaluation Feedback (Green / Red / Suggestions)

Upgraded the evaluation feedback output in the Vocab learning module from a monolithic string to a structured 3-part visual presentation.

## Key Decisions & Architecture
- **Rust DTO & Serialization**:
  `StudyFeedbackResult` now models `strengths: Vec<String>`, `weaknesses: Vec<String>`, and `suggestions: Vec<String>` with `#[serde(default)]` and robust aliases. Serialized into `study_attempts.feedback_text` as a JSON string to retain 100% database schema compatibility with `%APPDATA%/.vt-voice/learn.db`.
- **System Prompt Standardization**:
  Constrained LLM evaluation with explicit criteria and strict JSON schema in Vietnamese, requiring constructive strengths, clear weaknesses, and practical suggestions.
- **Shared Decoder Helper (`decodeFeedbackPayload`)**:
  Placed in `src/components/settings/vocab/types.ts` and consumed by `FeedbackPanel.tsx`, `StudyMode.tsx`, and `VocabNotebook.tsx`. Transparently differentiates between new structured JSON and legacy plain-text history, preventing raw JSON strings from leaking into history views.
- **UI & Accessibility**:
  Rendered compact Green (`emerald`), Red (`rose`), and Amber (`amber`) cards with icons (`CheckCircle2`, `AlertCircle`, `Lightbulb`) within the 720x560 settings window. If a translation has zero weaknesses, a positive "No major grammar errors" badge is displayed.

## Verification
- `bun test`: 76/76 tests pass across 8 test suites (1877 expect calls), including decoding and schema invariants in `tests/vocab.test.ts` and 100% key parity in `tests/i18n.test.ts`.
- `bun run build`: TypeScript compile (`tsc`) and Vite production bundle succeeded with 0 errors.
- `cargo check`: Rust backend compilation succeeded with 0 errors.
- `verify_learn_ai`: Standalone example passed 100% testing JSON extraction, snake_case deserialization, and structured feedback parsing.
- Subagent code review: Completed with `APPROVED` status.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

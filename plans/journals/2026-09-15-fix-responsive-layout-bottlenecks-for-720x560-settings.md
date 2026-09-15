---
title: Fix responsive layout bottlenecks for 720x560 settings
date: 2026-09-15
summary: "Fix FeatureBindingCard 1-column layout, ProviderManager name truncation, and ModelAllowlistModal nested scrollbar"
---

# Fix responsive layout bottlenecks for 720x560 settings

## Context & Diagnosis
The main settings window operates in a fixed 720x560 logical viewport with a 192px sidebar, leaving ~488px for the content pane.
1. `FeatureBindingCard.tsx`: `sm:grid-cols-2` was matching on the 720px viewport width and splitting 488px into two 238px columns, truncating model names and badges.
2. `FeatureBindingCard.tsx`: Footer flex-wrap triggered layout shifts when test results appeared.
3. `ProviderManager.tsx`: Row 1 lacked `min-w-0` and `truncate` on the provider name, risking overflow on long provider names.
4. `ModelAllowlistModal.tsx`: Nested `max-h-32` and `max-h-56` scroll containers produced multiple scrollbars inside a scrollable dialog.

## Decisions & Changes
- `FeatureBindingCard.tsx`: Switched container to plain `grid-cols-1` for consistent readability at 488px content width. Stabilized footer with `shrink-0` on action buttons and `min-w-0` on test latency badge.
- `ProviderManager.tsx`: Added `min-w-0` to flex containers, `truncate` to provider name `<span>`, and `shrink-0` to badge and action buttons.
- `ModelAllowlistModal.tsx`: Removed `max-h-32 overflow-y-auto` and `max-h-56 overflow-y-auto`, letting the parent `flex-1 overflow-y-auto` handle scrolling with a single scrollbar.

## Verification
- `bun run build`: TypeScript typecheck and Vite build succeeded with 0 errors.
- `bun test`: All 49 tests passed.
- `cd src-tauri && cargo check`: Rust backend compiled clean with 0 errors.

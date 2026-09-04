---
title: "settings-shadcn-migration"
description: "Migrate Settings window UI in vt-voice to shadcn/ui components (Radix primitives + Tailwind CSS), preserving Windows 11 Fluent Acrylic aesthetic while keeping OverlayPill and HotkeyRecorder intact."
status: completed
priority: P1
effort: "5.5h"
tags: ["frontend", "shadcn", "ui", "tauri", "react19", "tailwind"]
created: 2026-09-04
---

# Settings UI Migration to shadcn/ui

## Overview

Migrate the hand-crafted inline Tailwind CSS UI components in `vt-voice`'s Settings window (`SettingsLayout` and its 4 tabs: `GeneralTab`, `AudioTab`, `AiTab`, `HistoryTab`) to `shadcn/ui` components (Radix UI headless primitives + Tailwind CSS). 

This migration standardizes the design system, provides full WAI-ARIA accessibility and keyboard navigation for complex controls (`Select`, `Slider`, `Switch`, `Tabs`, `Dialog`, `Tooltip`), reduces inline styling duplication by ~40-50%, and preserves the custom Windows 11 Fluent Acrylic dark mode aesthetic (`.win11-acrylic`, `zinc-900/950`, emerald accents). 

Specialized desktop components (`OverlayPill` HUD floating RMS waveform visualizer and `HotkeyRecorder` Win32 key listener) remain completely untouched.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Configure shadcn/ui infrastructure for Vite 7 + React 19 + TypeScript + Tailwind 3.4 (`@/*` alias, `components.json`, `lib/utils.ts`). | P1 |
| 2 | Bridge shadcn design tokens with Windows 11 Fluent Acrylic styling (`.win11-acrylic` backdrop blur, semi-transparent zinc cards/popovers). | P1 |
| 3 | Migrate complex interactive widgets (`Select` for Audio/AI, `Slider` for VAD, `Switch`, `Tooltip`) in `AudioTab.tsx` and `AiTab.tsx`. | P1 |
| 4 | Standardize UI primitives (`Tabs`, `Button`, `Input`, `Card`, `Badge`) across `SettingsLayout.tsx`, `GeneralTab.tsx`, and `HistoryTab.tsx`. | P1 |
| 5 | Verify zero regression in Tauri IPC commands, full keyboard navigation, and clean `bun run build`. | P1 |

## Non-Goals

- Do not modify or refactor `src/components/OverlayPill.tsx` (the floating transparent HUD waveform visualizer).
- Do not modify the internal key-listening logic of `src/components/settings/HotkeyRecorder.tsx`.
- Do not modify Rust backend logic in `src-tauri/` or altered Tauri command signatures.
- Do not upgrade to Tailwind v4 or introduce heavy external state management libraries.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Infrastructure, Path Aliases & Fluent Acrylic Design Tokens](./phase-01-start.md) | Completed |
| 2 | [Phase 2: Complex Interactive Widgets Migration (Audio & AI Tabs)](./phase-02-complex-widgets-migration.md) | Completed |
| 3 | [Phase 3: Settings Layout & Remaining Tabs Migration (General & History Tabs)](./phase-03-settings-layout-and-tabs.md) | Completed |
| 4 | [Phase 4: Full-Suite Verification, Accessibility Testing & Visual Polish](./phase-04-verification-and-polish.md) | Completed |

## Success Criteria

- [x] `bun run build` succeeds with exit code 0 and no TypeScript/alias errors.
- [x] All 4 Settings tabs use shadcn primitives for tabs, inputs, selects, sliders, buttons, and switches.
- [x] Full keyboard navigation (Tab, Arrow keys, Enter, Escape) works seamlessly across all interactive controls.
- [x] Windows 11 Fluent Acrylic backdrop blur and translucent panel effects are preserved.
- [x] `OverlayPill` continues to display and animate real-time RMS audio waveforms with zero visual or performance regression.
- [x] All configuration loads and saves via Tauri IPC (`get_app_config`, `save_app_config`) without issue.

<!-- slug: settings-shadcn-migration -->

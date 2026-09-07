---
title: Planning hotkey combos and mouse button support
date: 2026-09-07
summary: Implementation plan for global hotkey chord combinations and mouse 4/5 (XButton1/2) hooks
---

# Planning hotkey combos and mouse button support

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Problem Context
User reported inability to set key combinations (`Ctrl + Space`, etc.) and mouse buttons 5 & 6 (side buttons / `VK_XBUTTON1`, `VK_XBUTTON2`) as hotkeys.

## Root Cause Analysis
1. **Frontend (`HotkeyRecorder.tsx`):**
   - Intercepts only `keydown`. As soon as any modifier (e.g. `ControlLeft`) is pressed down, it commits immediately and terminates recording, leaving no opportunity to press the main key.
   - Missing mouse event listeners (`mousedown`, `auxclick`, `contextmenu`). Clicking side buttons triggers default webview history back/forward.
2. **Backend Daemon (`hook.rs`):**
   - Installs only `WH_KEYBOARD_LL`. Low-level mouse events (`WM_XBUTTONDOWN`, `WM_XBUTTONUP`, `WM_MBUTTONDOWN`) are sent by Windows exclusively to `WH_MOUSE_LL`.
   - Release matching requires all modifiers to match strictly on `is_up`. When releasing modifier before key or key before modifier in Push-to-Talk or Toggle, `IS_HELD` gets permanently stuck `true`.
3. **Backend Config Sync (`lib.rs`):**
   - `save_app_config` failed to invoke `state.hotkey_manager.lock().update_config(...)`.

## Plan Created
Plan directory: `plans/260907-0927-hotkey-combos-and-mouse-buttons`
- Phase 1: Backend Hook (`WH_MOUSE_LL`) & Combo Release Engine (`matches_release`)
- Phase 2: Frontend Hotkey & Mouse Recorder (`HotkeyRecorder.tsx` chord detection, mouse capture, presets)
- Phase 3: Integration, Unit Tests & End-to-End Verification

## Refinement: Full Single-Key vs Combination Matrix
- Added `is_combo()` in `types.rs`:
  - If not a combo (single key): matches any single key (`F1-F24`, `Space`, `A-Z`, punctuation, mouse buttons `0x04`, `0x05`, `0x06`, or standalone modifiers `Left Alt`, `Right Alt`, `Left Ctrl`, `Right Ctrl`, `Left Shift`, `Right Shift`, `Win`, `CapsLock`) without requiring `!ctrl && !shift` to avoid blocking gamers while holding modifiers.
  - If combo: strictly matches main key + all required modifiers (`ctrl`, `alt`, `shift`, `win`).
- In `HotkeyRecorder.tsx`:
  - Tapping any non-modifier key or mouse button alone immediately commits that single key.
  - Holding modifier(s) and pressing a key or mouse button commits the combo.
  - Tapping a standalone modifier key alone (press and release without another key) commits that standalone modifier key.

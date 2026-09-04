---
phase: 3
title: "Settings Layout & Remaining Tabs Migration (General & History Tabs)"
status: pending
priority: P1
effort: "1.5h"
dependencies: [2]
---

# Phase 3: Settings Layout & Remaining Tabs Migration (General & History Tabs)

## Overview
Standardize foundational UI primitives across the remaining parts of the Settings window: migrate `SettingsLayout.tsx` to shadcn `Tabs` and `Button`, refactor `GeneralTab.tsx` with `Card` and `Switch`, and refactor `HistoryTab.tsx` with `Card`, `Badge`, and standardized action buttons. Ensure `OverlayPill` and `HotkeyRecorder` remain completely untouched.

## Requirements
- Functional:
  - `SettingsLayout.tsx` uses shadcn `<Tabs>` to switch between "general", "audio", "ai", and "history" tabs with keyboard support (Left/Right Arrow keys).
  - Title bar minimize and close buttons use `<Button variant="ghost" size="icon">` while preserving Tauri window control IPC (`getCurrentWindow().minimize()`, `getCurrentWindow().hide()`).
  - Save button shows loading spinner (`Loader2`) and checkmark (`Check`) states using shadcn Button variants.
  - `GeneralTab.tsx` uses `<Switch>` for `autostart` and `startMinimized`.
  - `HistoryTab.tsx` displays items in `<Card>` with timestamp `<Badge>` and copy-to-clipboard action button.
- Non-functional:
  - Do NOT touch `src/components/OverlayPill.tsx`.
  - Do NOT touch the internal key-binding logic of `src/components/settings/HotkeyRecorder.tsx`.
  - Preserve the acrylic blur window frame and draggable titlebar region (`data-tauri-drag-region`).

## Architecture
```
SettingsLayout:
  ├── Window Titlebar (data-tauri-drag-region, app icon, ghost minimize/close buttons)
  ├── Tabs Root (Radix Tabs primitive)
  │     ├── TabsList (horizontal pill container with emerald active tab indicator)
  │     │     ├── GeneralTrigger
  │     │     ├── AudioTrigger
  │     │     ├── AiTrigger
  │     │     └── HistoryTrigger
  │     └── TabsContent (renders GeneralTab, AudioTab, AiTab, HistoryTab)
  └── Footer Actions (Status toast indicator, Save Button with loading state)
```

## Related Code Files
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/badge.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx`
- Modify: `src/components/settings/GeneralTab.tsx`
- Modify: `src/components/settings/HistoryTab.tsx`

## Implementation Steps
1. **Install Primitives:**
   - Execute `bunx --bun shadcn@latest add tabs button input card badge`.
2. **Refactor `SettingsLayout.tsx`:**
   - Replace manual `activeTab` state and custom tab button loops with `<Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabId)}>`.
   - Use `<TabsList>` and `<TabsTrigger>` for clean tab switching.
   - Refactor window controls (minimize, close) to use `<Button variant="ghost" size="icon">` while ensuring `data-tauri-drag-region` works on draggable headers.
   - Refactor the primary "Lưu cấu hình" button to use shadcn `<Button>` with `disabled={isSaving}` and icon states.
3. **Refactor `GeneralTab.tsx`:**
   - Replace custom push-to-talk vs toggle cards with `<Card>` or radio card variants.
   - Replace manual toggles for "Khởi động cùng Windows" and "Bắt đầu thu nhỏ" with shadcn `<Switch>` and `<label>`.
   - Embed `<HotkeyRecorder>` cleanly without modifying its internal listeners.
4. **Refactor `HistoryTab.tsx`:**
   - Replace manual list items with `<Card className="p-3 bg-zinc-900/40 border-zinc-800">`.
   - Use `<Badge variant="outline">` for timestamps and provider tags.
   - Use `<Button variant="ghost" size="sm">` for the copy action.
5. **Verify Isolation:**
   - Confirm `OverlayPill.tsx` was not modified and has no unwanted imports or CSS regressions.

## Success Criteria
- [x] Tab switching works smoothly via mouse clicks and keyboard arrow keys.
- [x] Save configuration triggers `save_app_config` IPC and displays confirmation without UI glitches.
- [x] Window minimize and close buttons work reliably in the Tauri environment.
- [x] `HotkeyRecorder` continues to record and bind keys correctly in `GeneralTab`.
- [x] `OverlayPill` HUD remains fully functional and untouched.

## Risk Assessment
- **Risk:** Styling changes in `SettingsLayout` accidentally remove or break `data-tauri-drag-region`, preventing the user from moving the window on desktop.
  - *Observable signal:* Clicking and dragging the top title bar does not move the Tauri window.
  - *Pre-decided response:* Ensure the `data-tauri-drag-region` attribute is explicitly retained on the titlebar header element and child buttons have non-drag behavior.

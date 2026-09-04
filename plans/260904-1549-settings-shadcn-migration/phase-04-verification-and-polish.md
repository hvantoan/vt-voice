---
phase: 4
title: "Full-Suite Verification, Accessibility Testing & Visual Polish"
status: pending
priority: P1
effort: "1h"
dependencies: [3]
---

# Phase 4: Full-Suite Verification, Accessibility Testing & Visual Polish

## Overview
Perform end-to-end verification of the migrated Settings window: validate TypeScript types and production build, conduct full keyboard navigation and accessibility audits, verify visual fidelity with Windows 11 Fluent Acrylic blur, and guarantee zero regressions on background daemon operations and the `OverlayPill` floating HUD.

## Requirements
- Functional:
  - `bun run build` succeeds with zero errors and no bundle warnings.
  - All interactive controls in Settings are reachable and operable via keyboard alone.
  - All configurations successfully persist across app restarts (`get_app_config` and `save_app_config`).
  - Overlay HUD functions normally on hotkey press.
- Non-functional:
  - Visual check: No opaque pitch-black boxes breaking the `.win11-acrylic` backdrop blur.
  - Performance: Webview memory and render frames remain smooth (60fps audio waveform).

## Architecture
```
Verification Pipeline:
  ├── 1. Build Verification: `tsc && vite build`
  ├── 2. Accessibility Audit: Tab order, ARIA attributes, Arrow key navigation
  ├── 3. Acrylic & Theme Audit: Contrast check, border translucency, typography
  ├── 4. Desktop IPC Audit: Device listing, config persistence, window dragging
  └── 5. Overlay Regression Audit: OverlayPill floating HUD rendering & waveform animation
```

## Related Code Files
- Verify: `src/components/settings/SettingsLayout.tsx`
- Verify: `src/components/settings/GeneralTab.tsx`
- Verify: `src/components/settings/AudioTab.tsx`
- Verify: `src/components/settings/AiTab.tsx`
- Verify: `src/components/settings/HistoryTab.tsx`
- Verify: `src/components/OverlayPill.tsx`
- Verify: `src/index.css`

## Implementation Steps
1. **TypeScript & Bundling Check:**
   - Run `bun run build` to confirm clean compilation and asset generation.
2. **Keyboard Navigation & Accessibility Walkthrough:**
   - Open Settings window:
     - Navigate through tabs using `Arrow Left` / `Arrow Right`.
     - Open Select (Audio Device & AI Model) using `Space` or `Enter`, scroll items using `Arrow Up` / `Arrow Down`, select with `Enter`, and cancel with `Escape`.
     - Adjust VAD slider using `Arrow Left` / `Arrow Right`.
     - Toggle switches using `Space`.
     - Trigger Save button with `Enter` / `Space`.
3. **Fluent Acrylic Theme Polish:**
   - Inspect popover menus, tooltips, and dialogs against translucent desktop backgrounds.
   - Adjust border alpha (`rgba(255, 255, 255, 0.08)`) and card background alpha (`rgba(24, 24, 27, 0.65)`) if any component appears too opaque or washed out.
4. **Desktop IPC & Persistence Check:**
   - Change hotkey mode, audio device, VAD timeout, AI provider, and prompt.
   - Click Save, close the Settings window, reopen, and verify all values re-populate accurately from Rust store.
5. **Overlay HUD Regression Check:**
   - Press the configured hotkey.
   - Confirm `OverlayPill` appears on screen with proper translucent pill shape and dynamic audio level animation.
   - Release hotkey / speak into microphone to ensure audio capture pipeline is completely unaffected.

## Success Criteria
- [x] `bun run build` exits 0 with zero errors.
- [x] 100% of Settings controls can be navigated and activated via keyboard alone.
- [x] Windows 11 Fluent Acrylic aesthetic looks polished, cohesive, and modern.
- [x] Configuration save and restore cycle works without data loss.
- [x] `OverlayPill` HUD operates at full frame rate with zero visual defects.

## Risk Assessment
- **Risk:** Radix UI focus outline or active ring clashes with custom emerald accents or looks like generic blue web outline.
  - *Observable signal:* Clicking or focusing an input/button shows a bright default blue outline.
  - *Pre-decided response:* Ensure `--ring` variable is mapped to emerald (`16 185 129` / `hsl(158, 64%, 52%)`) and `focus-visible:ring-emerald-500` is applied across UI primitives.

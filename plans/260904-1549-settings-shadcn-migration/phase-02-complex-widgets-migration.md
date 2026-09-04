---
phase: 2
title: "Complex Interactive Widgets Migration (Audio & AI Tabs)"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Complex Interactive Widgets Migration (Audio & AI Tabs)

## Overview
Migrate high-complexity interactive components in `AudioTab.tsx` and `AiTab.tsx` to shadcn primitives: replace native dropdowns with `Select` (microphone devices and AI models/providers), replace range inputs with `Slider` (VAD timeout), add `Switch` for toggles, and use `Tooltip` for latency and feature explanations.

## Requirements
- Functional:
  - `Select` component correctly displays audio input devices returned by `get_audio_devices` Tauri command and updates `selectedDevice`.
  - `Select` component correctly switches between AI models and providers (`groq`, `openrouter`, `custom`).
  - `Slider` component accurately controls VAD timeout from 200ms to 2000ms with real-time value label update.
  - `Switch` component toggles `enablePolish` cleanly.
  - All existing IPC calls (`get_masked_provider_api_key`, `test_microphone`, `stop_test_mic`, `audio-level` listener) continue functioning without latency or state desync.
- Non-functional:
  - WAI-ARIA compliance: Keyboard navigation (Arrow keys, Enter, Escape) works inside Select dropdowns and Sliders.
  - Dropdown menu automatically repositions to avoid clipping outside Tauri window bounds.

## Architecture
```
AudioTab:
  ├── AudioDevice Select (Radix Select Primitive + Portal inside Tauri Webview)
  ├── VAD Timeout Slider (Radix Slider with emerald fill)
  └── Mic Test Button (shadcn Button with Loader2 / Activity indicator)

AiTab:
  ├── Provider Switcher (Cards / Select)
  ├── Model Select (Grouped or filtered by provider)
  ├── API Key Input (shadcn Input + show/hide toggle Button)
  ├── Polish Switch (shadcn Switch)
  └── Custom Vocabulary Badges (shadcn Badge with remove icon)
```

## Related Code Files
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/slider.tsx`
- Create: `src/components/ui/switch.tsx`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/dialog.tsx`
- Modify: `src/components/settings/AudioTab.tsx`
- Modify: `src/components/settings/AiTab.tsx`

## Implementation Steps
1. **Install shadcn Primitives:**
   - Execute `bunx --bun shadcn@latest add select slider switch tooltip dialog` to generate component files under `src/components/ui/`.
2. **Refactor `AudioTab.tsx`:**
   - Replace native HTML `<select>` with shadcn `<Select value={selectedDevice} onValueChange={setSelectedDevice}>`.
   - Replace `<input type="range">` with `<Slider value={[vadTimeout]} onValueChange={([val]) => setVadTimeout(val)} min={200} max={2000} step={50} />`.
   - Standardize the "Thử micro" button to `<Button variant="outline" size="sm">` with animated mic level meter.
3. **Refactor `AiTab.tsx`:**
   - Replace model selection menu with shadcn `<Select>`.
   - Replace `enablePolish` checkbox/toggle with `<Switch checked={enablePolish} onCheckedChange={setEnablePolish} />`.
   - Wrap provider cards or dropdown in standardized variants.
   - Use `<Badge variant="secondary">` for tags in `customVocab` with click-to-remove.
   - Wrap latency / speed chips in `<Tooltip>` components for helpful descriptions.
4. **IPC Contract & State Verification:**
   - Verify that switching providers re-fetches masked keys via `invoke("get_masked_provider_api_key", ...)`.
   - Verify that device selection propagates to `invoke("save_app_config", ...)`.

## Success Criteria
- [x] Select dropdown renders cleanly inside the Tauri window without creating horizontal/vertical body scrollbars.
- [x] Slider smoothly adjusts VAD timeout from 200ms to 2000ms.
- [x] Keyboard navigation: User can open Select with Space/Enter, navigate with Arrow keys, and select with Enter.
- [x] AI tab models load dynamically and can be selected via shadcn Select.
- [x] No regression in microphone testing or real-time level meters.

## Risk Assessment
- **Risk:** Radix UI `SelectContent` portal attaches to `document.body` and causes z-index or window overflow clipping in Tauri webview.
  - *Observable signal:* Dropdown list gets cut off at the bottom of the modal window or appears invisible.
  - *Pre-decided response:* Set `position="popper"` with `sideOffset={4}` on `SelectContent`, ensure portal container has appropriate z-index (`z-50`), and verify max-height is clamped (`max-h-[300px] overflow-y-auto`).

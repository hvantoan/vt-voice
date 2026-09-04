---
phase: 5
title: "Background Daemon, System Tray & Floating Overlay"
status: pending
priority: P1
effort: "6h"
dependencies: [1, 3]
---

# Phase 5: Background Daemon, System Tray & Floating Overlay

## Overview
Implement the complete desktop background daemon lifecycle, dynamic system tray icon state machine, and the non-activating floating pill overlay. Utilizes Win32 `SW_SHOWNOACTIVATE` and extended window styles so the floating overlay never steals foreground focus or disrupts active text carets in VS Code, Notepad, or browsers.

## Requirements
- Functional:
  - Application starts minimized/hidden to the Windows system tray (`visible: false`, `skipTaskbar: true`).
  - Intercept window close button (`WindowEvent::CloseRequested`) to hide window rather than terminate process.
  - Enforce single-instance execution via `tauri-plugin-single-instance`: Launching second instance brings Settings window to focus.
  - Dynamic System Tray via `TrayIconBuilder` with 4 states:
    1. `Idle`: Gray mic icon, tooltip "vt-voice: Ready".
    2. `Recording`: Red recording beacon, tooltip "vt-voice: Recording...".
    3. `Processing`: Amber pulse icon, tooltip "vt-voice: Polishing grammar...".
    4. `Error`: Alert triangle, tooltip "vt-voice: Error".
  - Floating Pill Overlay:
    - Anchored bottom-center of the primary monitor above the Windows taskbar.
    - Win32 extended styles: `WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_TOPMOST`.
    - Displayed via `ShowWindow(hwnd, SW_SHOWNOACTIVATE)` and `set_ignore_cursor_events(true)`.
    - 4 state animations: Listening with 4-bar RMS waveform, Processing spinner, Pasted checkmark flash, and Error badge.
    - Auto-hides 1.2s after successful insertion or when idle.
- Non-functional:
  - Zero foreground focus theft when overlay appears.
  - Idle memory footprint < 25MB RAM.

## Architecture
```
[Global Hotkey Pressed]
       │
       ├─► Tray: set_icon(Recording) & tooltip("Recording...")
       │
       └─► Overlay Window: ShowWindow(SW_SHOWNOACTIVATE)
             │ (emits "state-change" -> "listening")
             ▼
[Real-Time Audio Stream] ──► emit("audio-level", rms) ──► Waveform animates
       │
[Hotkey Released]
       │
       ├─► Tray: set_icon(Processing) & tooltip("Polishing...")
       ├─► Overlay: state -> "processing"
       ▼
[AI Pipeline Completes & Text Injected]
       │
       ├─► Overlay: state -> "pasted" (green check) ──► auto-hide after 1.2s
       └─► Tray: set_icon(Idle) & tooltip("Ready")
```

## Related Code Files
- Create: `src-tauri/src/daemon/mod.rs`
- Create: `src-tauri/src/daemon/tray.rs`
- Create: `src-tauri/src/daemon/overlay.rs`
- Create: `src-tauri/src/daemon/win32.rs`
- Create: `src/components/OverlayPill.tsx`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/App.tsx`

## Implementation Steps
1. Configure `tauri.conf.json`: Define `overlay` window (`transparent: true`, `decorations: false`, `alwaysOnTop: true`, `visible: false`, `width: 260`, `height: 48`).
2. Implement `win32.rs`: Win32 FFI helpers to apply `WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW` to the overlay HWND, intercept `WM_MOUSEACTIVATE` to return `MA_NOACTIVATE`, and call `ShowWindow(hwnd, SW_SHOWNOACTIVATE)`.
3. Implement `tray.rs`: Setup `TrayIconBuilder` with context menu (Mode toggle, Mic Mute, Settings, Quit) and state switching functions.
4. Implement `overlay.rs`: State controller managing overlay visibility, positioning above taskbar, and timeout dismissals.
5. Build `OverlayPill.tsx` in React: Compact dark frosted pill (`bg-zinc-950/85 backdrop-blur-xl border border-white/10 rounded-full`) with status dot, dynamic waveform bars, and state labels.
6. Connect Tauri event listener in React overlay to render live RMS levels and state transitions.

## Success Criteria
- [x] Active blinking cursor in VS Code does not lose focus or blink state when the overlay pill appears.
- [x] Tray icon dynamically transitions through Idle -> Recording -> Processing -> Idle.
- [x] Closing the Settings window hides to tray; re-opening from tray restores Settings.
- [x] Waveform bars in the overlay pill visibly bounce in sync with spoken voice volume.

## Risk Assessment
- *Risk*: Per-monitor DPI scaling causes overlay blur or offset on multi-monitor setups.
  *Mitigation*: Query active monitor metrics via Tauri's `window.current_monitor()` to compute physical coordinates.

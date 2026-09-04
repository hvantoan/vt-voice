# Research: Tauri v2 Background Daemon, Tray, Overlay & Settings UX

## 1. Executive Summary & Architectural Fit
- Target: Windows 11 x64 background voice-to-text dictation daemon.
- Stack: Tauri v2 (Rust host + WebView2 UI) + React frontend.
- Footprint target: <30MB idle RAM, 0% idle CPU. Achieved by starting with 0 visible WebViews; Settings Webview loads on-demand or hides to tray; Overlay Webview uses transparent click-through canvas.
- Multi-source baseline: Tauri v2 Official Docs (2024-2026), Microsoft Win32 Desktop Window Mgr docs, production precedents (Wispr Flow, Raycast, Voce).

## 2. Background Daemon & Window Configuration (`tauri.conf.json`)
- Daemon startup: Windows defined in `tauri.conf.json` start with `"visible": false` and `"skipTaskbar": true`.
- Close-to-Tray: Intercept `WindowEvent::CloseRequested` to prevent window destruction and invoke `window.hide()`.
```json
{
  "app": {
    "windows": [
      { "label": "main", "title": "vt-voice Settings", "width": 720, "height": 560, "visible": false, "skipTaskbar": true },
      { "label": "overlay", "title": "vt-voice Indicator", "width": 260, "height": 48, "decorations": false, "transparent": true, "alwaysOnTop": true, "visible": false, "skipTaskbar": true, "shadow": false, "focus": false, "resizable": false }
    ]
  }
}
```
- **Single Instance** (`tauri-plugin-single-instance = "2"`): Windows named pipe mutex. Second launch unhides/focuses settings window.
- **Autostart** (`tauri-plugin-autostart = "2"`): Configures `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. Supports `--minimized` launch flag.

## 3. System Tray Lifecycle & Dynamic State Machine
- Created via `tauri::tray::TrayIconBuilder` in `src-tauri/src/lib.rs` (requires `features = ["tray-icon"]`).
- Menu structure: Mode toggle (Cloud/Local), Mic Mute (`CheckMenuItem`), Settings, Separator, Quit.
- Left-click on tray icon toggles Settings window; right-click displays native context menu.
```rust
let menu = MenuBuilder::new(app).items(&[&mode_item, &mute_item, &sep, &settings_item, &quit_item]).build()?;
let tray = TrayIconBuilder::with_id("main-tray")
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .tooltip("vt-voice: Idle (Ready)")
    .on_menu_event(|app, event| match event.id().as_ref() {
        "settings" => { let w = app.get_webview_window("main").unwrap(); w.show().unwrap(); w.set_focus().unwrap(); },
        "quit" => app.exit(0),
        _ => {}
    })
    .build(app)?;
```
- State icon switching (`tray.set_icon` + `tray.set_tooltip`):
  1. `Idle`: Monochrome gray mic (`"vt-voice: Ready"`).
  2. `Recording`: Glowing red dot (`"vt-voice: Recording..."`).
  3. `Processing`: Amber pulse/arrows (`"vt-voice: Transcribing & Correcting..."`).
  4. `Error`: Red alert triangle (`"vt-voice: Error - Check API Key / Mic"`).

## 4. Floating Indicator / Pill Overlay (Non-Activating & Click-Through)
- **Critical Focus Trap**: Calling `window.show()` activates WebView2 and steals foreground focus from target editor (Notepad/VSCode). Caret vanishes; simulated keystrokes / `Ctrl+V` fail!
- **Solution: Win32 Extended Window Styles**:
  1. Window creation: Apply `WS_EX_NOACTIVATE (0x08000000)`, `WS_EX_TRANSPARENT (0x00000020)`, `WS_EX_TOOLWINDOW (0x00000080)`, `WS_EX_TOPMOST (0x00000008)`.
  2. Displaying: Use `windows_sys::Win32::UI::WindowsAndMessaging::ShowWindow(hwnd, SW_SHOWNOACTIVATE)`. Target editor retains 100% active focus and cursor!
  3. Click-through: In Rust, call `overlay_win.set_ignore_cursor_events(true)` so clicks pass to background app.
- **Positioning**: Anchored bottom-center of active monitor (`mon_x + (mon_w - win_w)/2`, `mon_y + mon_h - win_h - 64`).
- **Visual UX**: Compact dark pill (`backdrop-blur-md bg-zinc-950/85 rounded-full border border-white/10 px-4 py-2 flex items-center gap-3`).
  - Left: Status icon / spinner / error dot.
  - Middle: State label ("Listening..." / "Correcting...").
  - Right: 4-bar dynamic audio visualizer synced to RMS amplitude via `overlay_win.emit("audio-level", rms)`.

## 5. Settings & Local Storage Architecture
- Stored payloads: Cloud API keys (Groq/OpenAI/Gemini), Global Hotkeys, Model IDs, Prompts, Selected Audio Device GUID, Silence Threshold (VAD).
- **Trade-Off Matrix**:
| Solution | Security | Performance | Complexity | Assessment |
|---|---|---|---|---|
| **Option 1: Plain JSON (`tauri-plugin-store`)** | Low (Plaintext on disk) | High (<1ms) | Minimal | Good for non-secrets; insecure for API keys |
| **Option 2: Hybrid (Store + Windows Credential Manager)** | High (DPAPI encrypted) | High (<2ms) | Low | **Ranked #1 (Recommended)**: Store for prefs, `keyring` crate for keys |
| **Option 3: Embedded SQLite (`rusqlite`)** | Low-Med | Medium (5-10MB RAM) | High | Rejected: Excessive boilerplate, violates KISS |

- **Security Implementation (`keyring` crate v3)**:
```rust
use keyring::Entry;
// Store API key in Windows Credential Vault (never on disk)
Entry::new("vt-voice", "groq_api_key")?.set_password(api_key)?;
let groq_key = Entry::new("vt-voice", "groq_api_key")?.get_password()?;
```
- Non-sensitive preferences stored in `%APPDATA%\com.itvan.vt-voice\settings.json` via `tauri-plugin-store`.

## 6. Adoption Risk & Dependency Bill of Materials
- `tauri = { version = "2", features = ["tray-icon", "image-ico", "image-png"] }` (Official, stable)
- `tauri-plugin-single-instance = "2"` (Official Tauri plugin, high maturity)
- `tauri-plugin-autostart = "2"` (Official Tauri plugin, high maturity)
- `tauri-plugin-store = "2"` (Official Tauri plugin, high maturity)
- `keyring = "3.2"` (Mature cross-platform vault, binds Windows Credential Manager)
- `windows-sys = { version = "0.59", features = ["Win32_UI_WindowsAndMessaging", "Win32_Foundation"] }` (Zero-overhead Win32 FFI)
- Breaking-change risk: Low; Tauri v2 core API stabilized in late 2024.

## 7. Concrete Ranked Recommendations
1. **Daemon Lifecycle**: Hidden window bootstrap + `tauri-plugin-single-instance` + `tauri-plugin-autostart`. Prevent default window close, route to `window.hide()`.
2. **Tray Navigation**: `TrayIconBuilder` with 4 dynamic icon states; left-click toggles Settings; right-click displays quick actions.
3. **Floating Overlay**: Native Win32 `SW_SHOWNOACTIVATE` + `WS_EX_NOACTIVATE` + `set_ignore_cursor_events(true)` bottom-center floating pill.
4. **Configuration Storage**: Hybrid pattern (`tauri-plugin-store` for configs/hotkeys + `keyring` for Groq/OpenAI tokens).

## 8. Limitations & Unresolved Questions
- **Multi-Monitor DPI**: Win32 window positioning must account for Per-Monitor DPI scaling (`GetDpiForMonitor`) to prevent pill blur or misplacement on mixed-scaling setups.
- **Direct Caret Tracking**: Floating pill at current caret position vs screen bottom-center: Caret tracking via `GetGUIThreadInfo` / Windows UI Automation is notoriously unstable across Chromium/Electron/WPF. Recommendation: Stick to bottom-center fixed overlay.
- **Unresolved Question**: Should the floating overlay pill be optional via user preference in Settings, allowing power users to rely solely on the system tray icon for visual feedback?

---
phase: 1
title: "Environment & Native Dependencies"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Environment & Native Dependencies

## Overview
Install and verify the Rust toolchain on the Windows workstation, configure Tauri v2 native capabilities and plugins, add all required audio/Win32/HTTP crates to `Cargo.toml`, and set up Tailwind CSS with Lucide icons in the React frontend.

## Requirements
- Functional:
  - Working Rust/Cargo compiler targeting `x86_64-pc-windows-msvc`.
  - Configured `src-tauri/Cargo.toml` with `cpal`, `rubato`, `hound`, `windows`, `ringbuf`, `reqwest`, `keyring`, and Tauri v2 plugins.
  - Configured frontend dependencies: Tailwind CSS, Lucide React, and Google Fonts.
- Non-functional:
  - Build pipeline compiles cleanly with `pnpm build` and `cargo check`.

## Architecture
Tauri v2 host project configured with native plugins (`single-instance`, `autostart`, `store`). Webview configured with transparent multi-window support (`main` settings window and `overlay` pill window).

## Related Code Files
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `package.json`
- Create: `tailwind.config.js`
- Modify: `src/index.css` or `src/App.css`
1. Verify/install Rust toolchain using `winget install Rustlang.Rustup` or `rustup-init.exe`, targeting `x86_64-pc-windows-msvc`.
2. Update `src-tauri/Cargo.toml` with core dependencies:
   - `cpal = "0.15"`
   - `ringbuf = "0.4"`
   - `rubato = "0.15"`
   - `hound = "3.5"`
   - `windows = { version = "0.58", features = ["Win32_UI_WindowsAndMessaging", "Win32_UI_Input_KeyboardAndMouse", "Win32_System_DataExchange", "Win32_System_Memory", "Win32_Security", "Win32_System_Threading", "Win32_System_ProcessStatus"] }`
   - `reqwest = { version = "0.12", features = ["multipart", "json", "rustls-tls"], default-features = false }`
   - `keyring = "3.2"`
   - `tauri-plugin-single-instance = "2"`
   - `tauri-plugin-autostart = "2"`
   - `tauri-plugin-store = "2"`
3. Configure `tauri.conf.json` windows: `main` (hidden at launch, skipTaskbar) and `overlay` (transparent, frameless, non-activating, alwaysOnTop).
4. Install and configure frontend tooling: Tailwind CSS, `@types/node`, `lucide-react`.

## Success Criteria
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` succeeds without dependency errors.
- [x] `pnpm build` compiles React frontend assets to `dist/`.
- [x] Tauri capability file permits required plugin APIs.

## Risk Assessment
- *Risk*: Rust toolchain installation requires restart of terminal or system PATH refresh.
  *Mitigation*: Use direct path `C:\Users\itvan\.cargo\bin` during session or invoke directly.

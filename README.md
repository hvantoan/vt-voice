# vt-voice

`vt-voice` is a desktop application built with Tauri v2, Rust, React, and Vite on Windows x64.

## Architecture & Entry Points

Execution is partitioned across a frontend presentation layer and a native Rust core:

- **Frontend (Webview UI):** React application mounted at [`src/main.tsx`](src/main.tsx), with root view composition in [`src/App.tsx`](src/App.tsx).
- **Backend (Native Core):** Rust host initialized in [`src-tauri/src/main.rs`](src-tauri/src/main.rs) and configured in [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs).

For detailed process boundaries, IPC mechanics, security capabilities, and layer rationales, see [`docs/architecture.md`](docs/architecture.md).

## Workflow & Script Owners

Development and build workflows are owned by their respective project manifests:

- **Frontend scripts:** Development, build, and preview scripts are defined in [`package.json`](package.json).
- **Desktop packaging & build hooks:** Window settings, application metadata, and lifecycle commands (`beforeDevCommand`, `beforeBuildCommand`) are configured in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json).
- **Native compilation:** Rust dependencies and crate configuration are defined in [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml).

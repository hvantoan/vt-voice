# Architecture

`vt-voice` is a desktop application organized around a two-process boundary separating native OS capabilities from the user interface.

## Process Boundaries & Responsibilities

The application separates concerns between the webview presentation layer and the native host:

- **Webview UI (Frontend):** Owns UI presentation, visual components, and user interaction. Entry points: [`src/main.tsx`](../src/main.tsx) (application mount) and [`src/App.tsx`](../src/App.tsx) (root view).
- **Native Core (Backend):** Owns operating system APIs, audio hardware devices, DSP/audio I/O pipelines, system tray, and window management. Entry points: [`src-tauri/src/main.rs`](../src-tauri/src/main.rs) (process bootstrap) and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) (Tauri runtime configuration and command handler registration).

### Boundary Rationale

Isolating the presentation layer from the native backend ensures that UI rendering cycles cannot block low-latency audio processing or DSP pipelines. The native core provides direct access to Windows operating system subsystems and hardware interfaces that are inaccessible within the Webview sandbox.

## Inter-Process Communication (IPC)

Communication across the process boundary is facilitated through Tauri v2's command invoke mechanism:

- **Frontend invocation:** Dispatched via `@tauri-apps/api/core` from React components (see [`src/App.tsx`](../src/App.tsx)).
- **Native handler registration:** Exposed via `tauri::generate_handler!` within [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs).
- **Serialization:** Data exchange models across IPC are managed by `serde` in [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml).

## Security & Capability Boundaries

Tauri v2 enforces runtime permissions through explicit capability declarations:

- Security boundaries, window scopes, and granted permissions are defined in [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json).
- The webview process is denied access to native APIs and plugins unless explicitly authorized in the capability configuration.

## Configuration & Tooling Owners

Build lifecycle hooks and configuration parameters are owned by their respective configuration manifests:

- **Window specifications & build hooks:** [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) defines window dimensions, application metadata, security policies, and build lifecycle hooks (`beforeDevCommand`, `beforeBuildCommand`). Note: build commands in this manifest control the package manager invocation for dev and release builds.
- **Frontend scripts & dependencies:** [`package.json`](../package.json) defines script targets and web dependencies; [`vite.config.ts`](../vite.config.ts) defines bundler configuration and dev server ports.
- **Native dependencies:** [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) manages Rust crates and native compilation targets.

---
title: "Phase 1: Backend, Dependencies & Tauri Config"
status: todo
---

# Phase 1: Backend, Dependencies & Tauri Config

## Overview

Cài đặt dependencies Tauri v2 (`updater`, `process`), cấu hình `tauri.conf.json` và `capabilities/default.json`, kích hoạt `tauri-plugin-single-instance`, thêm tùy chọn `auto_check_updates` vào `AppConfig`, tạo logic kiểm tra/tải/cài đặt ở Rust backend và cập nhật menu System Tray.

## Requirements

- [x] Thêm `tauri-plugin-updater = "2"` và `tauri-plugin-process = "2"` vào `src-tauri/Cargo.toml`.
- [x] Thêm `@tauri-apps/plugin-updater` và `@tauri-apps/plugin-process` vào `package.json`.
- [x] Bật `bundle.createUpdaterArtifacts = true` và `plugins.updater` trong `src-tauri/tauri.conf.json`.
- [x] Cấp quyền `updater:default` và `process:allow-restart` trong `src-tauri/capabilities/default.json`.
- [x] Thêm `auto_check_updates: bool` (default `true`) vào `AppConfig` trong `src-tauri/src/storage/config.rs` kèm unit test serde.
- [x] Tạo `src-tauri/src/updater.rs` quản lý `check_for_updates`, `install_update`, background check khi khởi động và phát event `updater:available` / `updater:progress`.
- [x] Cập nhật `src-tauri/src/daemon/tray.rs` để hiển thị mục menu khi có bản cập nhật mới và mở cửa sổ `main` khi click.
- [x] Đăng ký `single_instance` (đầu tiên), `process`, `updater` và các command mới trong `src-tauri/src/lib.rs`.

## Implementation Steps

1. Viết/bổ sung unit tests trước cho `AppConfig` (`auto_check_updates` default & serde) và `TrayStrings` (update menu localization).
2. Cập nhật `src-tauri/Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`.
3. Cập nhật `src-tauri/src/storage/config.rs` và `src-tauri/src/daemon/tray.rs`.
4. Tạo `src-tauri/src/updater.rs` và kết nối vào `src-tauri/src/lib.rs`.
5. Chạy `cargo check` trong `src-tauri` để xác nhận biên dịch sạch.

## Todo

- [x] Cập nhật `Cargo.toml` và `package.json`
- [x] Cấu hình `tauri.conf.json` và `capabilities/default.json`
- [x] Thêm `auto_check_updates` vào `storage/config.rs` + unit test
- [x] Cập nhật `daemon/tray.rs` với menu item cập nhật + unit test
- [x] Tạo `src-tauri/src/updater.rs` và đăng ký plugins/commands trong `lib.rs`

## Success Criteria

- `cd src-tauri && cargo check` thành công với exit code 0.
- Các test trong `storage/config.rs` và `daemon/tray.rs` giữ đầy đủ độ phủ và không phá vỡ tương thích ngược `settings.json`.

---
title: "Auto-Update cho vt-voice (Tauri v2)"
description: "Tích hợp tauri-plugin-updater, tauri-plugin-process, single-instance, UI kiểm tra cập nhật trong GeneralTab, thông báo qua System Tray và ký artifact trong GitHub Releases."
status: completed
priority: P1
effort: "4h"
tags: [auto-update, tauri-v2, windows, ci-cd, tray]
created: 2026-11-13
---

# Auto-Update cho vt-voice (Tauri v2)

## Overview

Tích hợp cơ chế tự động kiểm tra, thông báo không làm phiền và cài đặt bản cập nhật cho `vt-voice` trên Windows thông qua GitHub Releases công khai (`hvantoan/vt-voice`), sử dụng `tauri-plugin-updater`, `tauri-plugin-process` và `tauri-plugin-single-instance`.

Tham khảo nghiên cứu kiến trúc: [261113-auto-update-architecture.md](../research/261113-auto-update-architecture.md).

## Goals

| # | Goal | Priority |
|---|---|---|
| 1 | Kích hoạt `single-instance`, `updater` và `process` ở Rust backend với luồng kiểm tra ngầm không làm phiền | P1 |
| 2 | Hiển thị thông báo có bản mới trên System Tray menu và UI quản lý cập nhật trong `GeneralTab` (song ngữ `vi`/`en`) | P1 |
| 3 | Cấu hình `createUpdaterArtifacts` và ký Minisign tự động trong `.github/workflows/release.yml` | P1 |

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Phase 1: Backend, Dependencies & Tauri Config](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Frontend UI, State & i18n](./phase-02-frontend-ui.md) | Pending |
| 3 | [Phase 3: Release CI/CD & Verification](./phase-03-release-ci-and-verify.md) | Pending |

## Success Criteria

- [ ] `src-tauri/tauri.conf.json` bật `createUpdaterArtifacts: true` và cấu hình `plugins.updater` trỏ về `https://github.com/hvantoan/vt-voice/releases/latest/download/latest.json` với `windows.installMode: "passive"`.
- [ ] `src-tauri/src/lib.rs` đăng ký `tauri_plugin_single_instance` đầu tiên, cùng `tauri_plugin_updater` và `tauri_plugin_process`.
- [ ] `AppConfig` hỗ trợ `auto_check_updates` (mặc định `true`), System Tray hiển thị mục cập nhật khi có bản mới, `GeneralTab` có UI kiểm tra/tải/cài đặt với thanh tiến trình.
- [ ] `.github/workflows/release.yml` cấu hình `TAURI_SIGNING_PRIVATE_KEY` và `includeUpdaterJson: true`.
- [ ] `bun test`, `bun run build`, và `cargo check` pass 100% không lỗi.

<!-- slug: auto-update -->

---
title: "Phase 3: Release CI/CD & Verification"
status: todo
---

# Phase 3: Release CI/CD & Verification

## Overview

Cập nhật workflow phát hành `.github/workflows/release.yml` để ký các bản build bằng `TAURI_SIGNING_PRIVATE_KEY` và tạo/upload `latest.json` + `.sig`, đồng thời bổ sung test kiểm tra cấu hình release tooling.

## Requirements

- [x] Cập nhật `.github/workflows/release.yml`: thêm `TAURI_SIGNING_PRIVATE_KEY` và `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vào `env` của step `Build Tauri and Publish Release`, bật `includeUpdaterJson: true`.
- [x] Cập nhật `tests/release-tooling.test.ts` để xác nhận `release.yml` và `tauri.conf.json` có đầy đủ cấu hình updater.
- [x] Chạy kiểm tra tổng thể cuối cùng (`bun test`, `bun run build`, `cd src-tauri && cargo check`).

## Implementation Steps

1. Bổ sung assertions vào `tests/release-tooling.test.ts` (TDD).
2. Cập nhật `.github/workflows/release.yml`.
3. Chạy lại toàn bộ `bun test`, `bun run build`, và `cd src-tauri && cargo check`.

## Todo

- [x] Cập nhật `tests/release-tooling.test.ts`
- [x] Cập nhật `.github/workflows/release.yml`
- [x] Chạy full verification (`bun test`, `bun run build`, `cargo check`)

## Success Criteria

- `tests/release-tooling.test.ts` và toàn bộ `bun test` pass 100%.
- `bun run build` và `cd src-tauri && cargo check` pass 100%.

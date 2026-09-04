---
phase: 4
title: "Settings UI Provider & Model Selector"
status: completed
priority: P1
effort: "3h"
dependencies: [1, 2, 3]
---

# Phase 4: Settings UI Provider & Model Selector

## Overview
Redesign the React 19 Settings dashboard's AI tab (`src/components/settings/AiTab.tsx`). Provide an intuitive provider selector (Groq, OpenRouter, Custom), dynamic STT model dropdown, masked API key manager with per-provider connection testing, and a Pure STT mode toggle.

## Requirements
- Functional:
  - Provider Selector: Segmented pill selector or clean dropdown offering `Groq (Mặc định - Siêu nhanh)`, `OpenRouter (OpenAI-compatible đa model)`, and `Tùy chỉnh (Custom Endpoint)`.
  - API Key Security & Presentation:
    - Load masked key (`sk-or-••••••••abcd`) on mount; toggle reveal/edit.
    - Provide "Kiểm tra kết nối" button that invokes `test_provider_connection` and displays latency badge (e.g. `185 ms`).
    - Provide "Lưu Key" action that securely persists to Windows Credential Manager.
  - STT Model Dropdown:
    - Auto-load models from `get_available_stt_models(activeProvider)`.
    - Display model name and badge (e.g. `Khuyên dùng`).
    - Save selected `stt_model` to `AppConfig`.
  - Pure STT Mode Toggle ("Tắt sửa tiếng / Pure STT"):
    - Toggle switch for `enable_polish`.
    - Clear explanatory caption: *"Tắt bước AI sửa tiếng để dán văn bản ngay lập tức (<300ms). Whisper vẫn nhận diện đúng từ kỹ thuật Việt-Anh nhờ từ vựng nạp sẵn."*
    - When disabled, collapse/disable LLM system prompt settings to reduce visual clutter.
  - Custom Vocabulary Tags: retain tag manager so users can add custom acronyms and project terms.

## UI Design & Layout

```text
┌────────────────────────────────────────────────────────┐
│ Nhà cung cấp AI (Provider)                            │
│ [ Groq (Khuyên dùng) ]   [ OpenRouter ]   [ Tùy chỉnh ]│
├────────────────────────────────────────────────────────┤
│ API Key (Bảo mật qua Windows Credential Vault)         │
│ [ sk-or-v1-••••••••4a2f       ] [👁] [Kiểm tra] [Lưu] │
│ ✓ Kết nối thành công (192ms)                           │
├────────────────────────────────────────────────────────┤
│ Mô hình Nhận diện Giọng nói (STT Model)                │
│ [ openai/whisper-1 (Khuyên dùng)                    ▼] │
│ ↻ Tải lại danh sách model                              │
├────────────────────────────────────────────────────────┤
│ Chế độ hoạt động                                      │
│ [X] Tắt AI sửa tiếng (Chế độ Pure STT siêu tốc)        │
│     Bỏ qua bước LLM để đạt độ trễ tối thiểu <300ms.    │
├────────────────────────────────────────────────────────┤
│ Từ vựng kỹ thuật bổ sung (Custom Vocabulary)           │
│ [Tauri x] [EVKey x] [Kafka x] [+ Thêm từ mới]          │
└────────────────────────────────────────────────────────┘
```

## Related Code Files
- Modify: `src/components/settings/AiTab.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx`
- Modify: `src/App.tsx`

## Implementation Steps
1. Update component props in `src/components/settings/AiTab.tsx`:
   - `activeProvider: string`, `setActiveProvider: (p: string) => void`
   - `sttModel: string`, `setSttModel: (m: string) => void`
   - `enablePolish: boolean`, `setEnablePolish: (v: boolean) => void`
   - `customEndpoint?: string`, `setCustomEndpoint: (url: string) => void`
2. Implement provider switching logic:
   - On provider switch, invoke `get_masked_provider_api_key(newProvider)` to load the respective masked key.
   - Invoke `get_available_stt_models(newProvider, false)` to refresh the model dropdown options.
   - Reset connection test status and latency indicators.
3. Add "Kiểm tra kết nối" handler:
   - Invoke `test_provider_connection(activeProvider, currentKey, customEndpoint)`.
   - Show loading spinner during test, green checkmark with latency on success, and red error banner on failure.
4. Add Pure STT toggle:
   - Add switch for `enable_polish`.
   - Conditionally render System Prompt textarea only when `enable_polish === true`.
5. Update `src/App.tsx` and `SettingsLayout.tsx` to bind new configuration fields with `get_app_config` and `save_app_config`.

## Success Criteria
- [x] Switching between Groq and OpenRouter dynamically updates the API key input to reflect the stored key for that specific provider.
- [x] Model dropdown displays populated models from `get_available_stt_models`.
- [x] Toggling Pure STT collapses LLM prompt settings and saves `enable_polish: false` to config.
- [x] "Kiểm tra kết nối" button measures and displays real latency for both Groq and OpenRouter.

## Risk Assessment
- **Risk**: User types a new API key but forgets to click "Save" before switching tabs.
  - *Signal*: Local input dirty state without matching vault update.
  - *Mitigation*: Auto-save provider key when user clicks "Lưu cài đặt" or triggers a successful "Kiểm tra kết nối".

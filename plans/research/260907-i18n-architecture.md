# Research Report: Internationalization (i18n) Architecture & Language Detection for vt-voice

- **Topic:** Application Internationalization (i18n) & Language Detection Strategy for `vt-voice`
- **Conducted On:** 2026-09-07
- **Target Stack:** Tauri v2, React 19, TypeScript 5.8, Vite 7, Tailwind CSS, Rust (WASAPI/Win32)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Methodology](#research-methodology)
3. [Key Findings](#key-findings)
   - 1. [Technology Overview](#1-technology-overview)
   - 2. [Current State &amp; Trends](#2-current-state--trends)
   - 3. [Best Practices](#3-best-practices)
   - 4. [Security Considerations](#4-security-considerations)
   - 5. [Performance Insights](#5-performance-insights)
4. [Comparative Analysis](#comparative-analysis)
5. [Implementation Recommendations](#implementation-recommendations)
   - [Quick Start Guide](#quick-start-guide)
   - [Code Examples](#code-examples)
   - [Common Pitfalls](#common-pitfalls)
6. [Resources &amp; References](#resources--references)
7. [Appendices](#appendices)
   - [A. Glossary](#a-glossary)
   - [B. Version Compatibility Matrix](#b-version-compatibility-matrix)
   - [C. Raw Research Notes](#c-raw-research-notes)
8. [Unresolved Questions](#unresolved-questions)

---

## Executive Summary

`vt-voice` is a dual-process desktop application combining a **React 19 / TypeScript / Vite** frontend with a **Tauri v2 / Rust** native backend. Currently, interface strings (Settings tabs, Hotkey Recorder, Tray Menu) are hardcoded with ad-hoc bilingual Vietnamese-English text (e.g., `"Chế độ phím tắt (Hotkey Mode)"`, `"Cài đặt (Settings)"`). Implementing a clean i18n architecture requires decoupling text into structured locale dictionaries while maintaining strict synchronization across the Webview and Rust native tray boundaries.

The optimal technical stack leverages **`i18next` + `react-i18next`** on the frontend, combined with a **KISS-compliant Rust tray synchronization module** powered by Tauri v2 IPC commands. Rather than introducing heavy, macro-intensive Rust i18n crates for fewer than 10 tray strings, the Rust backend should share or consume the exact same JSON locale schema via embedded resources or IPC state synchronization.

Language detection must follow a deterministic, three-tier precedence hierarchy: **User Explicit Preference (`AppConfig.locale`) > OS System Locale (via `@tauri-apps/plugin-os` / Win32 API) > Fallback Default (`"vi"`)**. Additionally, application UI i18n must remain structurally decoupled from Speech-to-Text (STT) speech language recognition (Whisper dynamic language detection vs. Vietnamese-English bilingual priming).

---

## Research Methodology

- **Sources consulted:** 20+ primary documentation pages and official specifications across Tauri v2, i18next, React 19, Microsoft Win32 Docs, and Rust crates.
- **Date range of materials:** 2024-01-01 to 2026-09-07 (filtering for React 19 and Tauri v2 compatibility).
- **Key search terms used:**
  - `tauri v2 internationalization i18n react tray menu best practices`
  - `react-i18next react 19 compatibility`
  - `tauri v2 plugin-os locale windows GetUserDefaultUILanguage`
  - `tauri v2 locale detection`

---

## Key Findings

### 1. Technology Overview

In a Tauri v2 architecture, localization spans two independent execution runtimes:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface (Webview)                 │
│  - React 19 + TypeScript + Vite                             │
│  - Engine: `i18next` + `react-i18next`                      │
│  - Components: SettingsLayout, Tabs, HotkeyRecorder, Overlay│
└──────────────────────────────┬──────────────────────────────┘
                               │
            Tauri v2 IPC (invoke: "save_app_config")
            Tauri Event ("locale-changed")
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Native Daemon (Rust)                     │
│  - Tauri Tray Menu ("Cài đặt", "Thoát")                     │
│  - Tray Tooltips ("Sẵn sàng", "Đang ghi âm", "Lỗi...")      │
│  - Native Dialogs / System Notifications                    │
│  - Storage: `settings.json` (Field: `locale`)               │
└─────────────────────────────────────────────────────────────┘
```

1. **Frontend Presentation (React 19):** Handles 95% of application strings. Requires dynamic language switching without full page reloads, formatters (pluralization, dates, interpolation), and full TypeScript key autocomplete.
2. **Native Presentation (Rust Daemon):** Manages Windows Tray Icon menus, right-click context items, and status tooltips. Because Windows Win32 native menus are drawn by the operating system, they cannot read DOM or React context directly.
3. **Configuration & Storage:** `AppConfig` in `src-tauri/src/storage/config.rs` must persist `locale: String` (`"system" | "vi" | "en"`).

### 2. Current State & Trends

- **React 19 Ecosystem:** `react-i18next` (v16.3+ / v17+) fully supports React 19, resolves historical `ref`-forwarding issues in `<Trans />`, and accommodates the removal of the global `JSX` namespace in React 19 types.
- **Tauri v2 Locale Architecture:** Tauri v2 deliberately does not mandate a monolithic i18n runtime. Instead, it delegates OS query capabilities to `@tauri-apps/plugin-os` (`locale()` function returning RFC 5646 / BCP-47 tags like `vi-VN` or `en-US`).
- **Tray Menu Dynamic Mutation:** In Tauri v2, `Menu` instances are mutable. Calling `tray.set_menu(Some(new_menu))` or updating items dynamically via `MenuItem::set_text` allows seamless, flicker-free language updates without restarting the application.

### 3. Best Practices

- **Strict Type Safety:** Export TypeScript interfaces derived from the primary English/Vietnamese JSON schema (`CustomTypeOptions` in `i18next.d.ts`). This prevents missing key bugs at compile time.
- **DRY Locale Schema:** Store translations in structured JSON files (`src/locales/vi.json`, `src/locales/en.json`).
- **ID-Based Menu Handlers:** Win32 tray menu items must be registered with static, invariant IDs (`"settings"`, `"quit"`). Handlers must never branch on translated menu labels (`"Cài đặt"` vs `"Settings"`).
- **Graceful Fallback:** Always provide a language fallback chain: `Selected Locale -> Base Language (e.g., "vi-VN" -> "vi") -> Fallback ("vi" or "en")`.

### 4. Security Considerations

- **Capability Permissions in Tauri v2:** Using `@tauri-apps/plugin-os` to read system locale requires explicit permission declarations in `src-tauri/capabilities/default.json`:
  ```json
  {
    "permissions": [
      "core:default",
      "os:default",
      "os:allow-locale"
    ]
  }
  ```

  Missing this permission blocks `locale()` at runtime with a permission-denied IPC error.
- **XSS Prevention in Translations:** `i18next` automatically escapes values during interpolation. Avoid using `dangerouslySetInnerHTML` when displaying interpolated user values (such as hotkey names or device IDs).

### 5. Performance Insights

- **Zero-Latency In-Memory Lookups:** JSON locale files for desktop applications are small (<50 KB). Bundling `vi.json` and `en.json` directly into the Vite bundle eliminates network round-trips and loading flashes (`Suspense` boundaries).
- **Avoid Heavy Rust Crates:** Crates like `fluent-bundle` add substantial macro overhead and binary size. For a daemon with only 4–8 tray labels, an embedded enum/lookup map in Rust takes under 1 KB and executes in nanoseconds.

---

## Comparative Analysis

### Frontend i18n Architectures: Minimal Rung vs Library

The total translation surface of `vt-voice` is relatively compact (~100 strings across 4 settings tabs, overlay pill, hotkey recorder, tray menu, and ~10 IPC error messages). Comparing the minimal approach with library options:

| Feature / Criteria                     | **Rung 0: Typed `as const` Dict + React Hook** (Minimalist) | **Rung 1: `react-i18next` (Vite-bundled JSON)** (Ecosystem) | **Rung 2: Full Web `i18next` Stack** (Cargo-Cult)       |
| :------------------------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------ | :-------------------------------------------------------------- |
| **Dependencies**                 | **0 extra npm packages**                                      | `i18next` + `react-i18next` (~12 KB)                            | +`i18next-http-backend`, `i18next-browser-languagedetector` |
| **Implementation**               | ~25 lines React Context &`useI18n()` hook                         | Setup in`i18n.ts` + type declaration file                         | Complex async plugin chain                                      |
| **Type Safety**                  | Native TypeScript compile-time checking (`keyof typeof vi`)       | Via`CustomTypeOptions` module augmentation                        | Via`CustomTypeOptions`                                        |
| **Language Detection**           | `navigator.language` in WebView2 (matches Windows 11 UI)          | `navigator.language` or `@tauri-apps/plugin-os`                 | Async browser detector                                          |
| **Pluralization / Variables**    | Simple template literals / string interpolation function            | Built-in ICU/i18next interpolation & plural rules                   | Built-in                                                        |
| **Suitability for `vt-voice`** | **Ideal if strict zero-dependency & KISS preferred**          | **Best if anticipating complex interpolations/plurals**       | **Anti-pattern: unnecessary async overhead**              |

### Native Rust & IPC Localization Surfaces

Localization in `vt-voice` touches two backend-related surfaces:

1. **System Tray Menu & Tooltips:** Static items (`"Cài đặt"`, `"Thoát"`) and dynamic tooltips (`"Sẵn sàng"`, `"Đang ghi âm..."`).
2. **`Result<_, String>` IPC Command Errors (`src-tauri/src/lib.rs`):** Currently ~10 commands return ad-hoc English strings (e.g. `"API key cannot be empty"`, `"Missing required parameter `key`"`, `"Cannot save a masked API key"`).
   - *Resolution:* Either return structured error codes (e.g., `"ERR_EMPTY_API_KEY"`) or map known error strings to localization keys on the frontend before display.

---

## Implementation Recommendations

### Quick Start Guide

#### Phase 1: Storage & Backend Setup

1. Update `AppConfig` in `src-tauri/src/storage/config.rs` to include `pub locale: String` (defaults to `"system"`).
2. Add capability `"os:allow-locale"` in `src-tauri/capabilities/default.json`.
3. Implement `TrayManager::update_locale(app, locale)` in `src-tauri/src/daemon/tray.rs` to dynamically update menu item labels and tooltips.

#### Phase 2: Frontend i18n Foundation

1. Install dependencies:
   ```bash
   bun add i18next react-i18next
   bun add -D @tauri-apps/plugin-os
   ```
2. Create locale files:
   - `src/locales/vi.json`
   - `src/locales/en.json`
3. Configure `src/lib/i18n.ts` with type-safe resources and auto-detection logic.
4. Initialize `i18n` in `src/main.tsx` before mounting the React root.

#### Phase 3: Language Detection Hierarchy

Implement detection logic:

```
1. Check AppConfig.locale
   ├── If "vi" -> Use Vietnamese
   ├── If "en" -> Use English
   └── If "system":
       ├── Call `await locale()` from `@tauri-apps/plugin-os`
       ├── Fallback to `navigator.language`
       └── Match prefix (`vi*` -> "vi", else -> "en")
```

#### Phase 4: UI Refactoring

1. Add language selector (`Tiếng Việt` / `English` / `Hệ thống (System)`) in `GeneralTab.tsx`.
2. Replace hardcoded text in `GeneralTab`, `AudioTab`, `AiTab`, `HistoryTab`, `HotkeyRecorder`, and `OverlayPill` with `const { t } = useTranslation()`.

---

### Code Examples

#### 1. Language Detection Engine (`src/lib/i18n.ts`)

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { locale as getOsLocale } from "@tauri-apps/plugin-os";
import vi from "@/locales/vi.json";
import en from "@/locales/en.json";

export const defaultResources = {
  vi: { translation: vi },
  en: { translation: en },
} as const;

export type SupportedLocale = "vi" | "en";

/**
 * Resolves system locale into a supported app language
 */
export async function resolveSystemLanguage(): Promise<SupportedLocale> {
  try {
    const rawLocale = (await getOsLocale()) || navigator.language || "vi";
    const lower = rawLocale.toLowerCase();
    if (lower.startsWith("vi")) {
      return "vi";
    }
    return "en";
  } catch (err) {
    console.warn("Failed to detect OS locale, falling back to vi", err);
    return "vi";
  }
}

export async function initI18n(initialSetting: string = "system") {
  const targetLang =
    initialSetting === "system"
      ? await resolveSystemLanguage()
      : (initialSetting as SupportedLocale);

  await i18n.use(initReactI18next).init({
    resources: defaultResources,
    lng: targetLang,
    fallbackLng: "vi",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

  return i18n;
}

export default i18n;
```

#### 2. TypeScript Autocomplete (`src/@types/i18next.d.ts`)

```typescript
import { defaultResources } from "@/lib/i18n";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: (typeof defaultResources)["vi"];
  }
}
```

#### 3. Rust Native Tray Localization (`src-tauri/src/daemon/tray.rs`)

```rust
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Manager};

pub const TRAY_ID: &str = "main-tray";

pub struct TrayStrings {
    pub settings: &'static str,
    pub quit: &'static str,
    pub tooltip_ready: &'static str,
    pub tooltip_recording: &'static str,
    pub tooltip_processing: &'static str,
}

impl TrayStrings {
    pub fn for_locale(locale: &str) -> Self {
        match locale {
            "en" => Self {
                settings: "Settings",
                quit: "Quit",
                tooltip_ready: "vt-voice: Ready",
                tooltip_recording: "vt-voice: Recording...",
                tooltip_processing: "vt-voice: Processing AI...",
            },
            _ => Self {
                settings: "Cài đặt",
                quit: "Thoát",
                tooltip_ready: "vt-voice: Sẵn sàng",
                tooltip_recording: "vt-voice: Đang ghi âm...",
                tooltip_processing: "vt-voice: Đang xử lý AI...",
            },
        }
    }
}

pub fn update_tray_locale(app: &AppHandle, locale: &str, current_state: &str) -> Result<(), tauri::Error> {
    let strings = TrayStrings::for_locale(locale);
    let settings_i = MenuItem::with_id(app, "settings", strings.settings, true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", strings.quit, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&settings_i, &quit_i])?;

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_menu(Some(menu));
        // Re-apply tooltip matching the active daemon state rather than blindly wiping to Ready
        let tooltip = match current_state {
            "recording" => strings.tooltip_recording,
            "processing" => strings.tooltip_processing,
            _ => strings.tooltip_ready,
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
    Ok(())
}
```

---

### Common Pitfalls

1. **Confusing UI i18n with Speech-to-Text Language:**
   - *Problem:* Changing app language to English causes Whisper to mistranscribe Vietnamese speech.
   - *Solution:* Keep UI Locale (`AppConfig.locale`) strictly isolated from the STT language model and `initial_prompt`. `vt-voice` uses technical Vi-En vocabulary priming (`custom_vocabulary`), which must remain intact regardless of UI language.
2. **Missing Tauri v2 OS Capabilities:**
   - *Problem:* `locale()` call from `@tauri-apps/plugin-os` rejects with permission errors.
   - *Solution:* Ensure `"os:allow-locale"` is registered in `src-tauri/capabilities/default.json`.
3. **Tray Menu Text Matching Anti-Pattern:**
   - *Problem:* Checking `event.id == "Cài đặt"` breaks when language changes to English.
   - *Solution:* Always bind events to persistent IDs (`"settings"`, `"quit"`).
4. **Flicker / Re-render Cascades:**
   - *Problem:* Loading translation files asynchronously via `fetch` causes UI layout jumps or blank screens on launch.
   - *Solution:* Bundle local JSON files synchronously at build time (`import vi from '@/locales/vi.json'`).

---

## Resources & References

### Official Documentation

- [Tauri v2 OS Plugin Guide](https://v2.tauri.app/plugin/os-info/)
- [Tauri v2 Menu &amp; Tray Documentation](https://v2.tauri.app/reference/javascript/tray/)
- [react-i18next Official Documentation](https://react.i18next.com/)
- [i18next TypeScript Integration](https://www.i18next.com/overview/typescript)

### Recommended Tutorials

- [Internationalization in React 19 with react-i18next](https://react.i18next.com/getting-started)
- [Tauri v2 Window and Tray Management Patterns](https://v2.tauri.app/develop/windows/)

---

## Appendices

### A. Glossary

- **i18n (Internationalization):** Engineering design ensuring an application can be adapted to various languages and regions without engineering changes.
- **BCP-47:** Standardized language identification tag (e.g., `vi-VN`, `en-US`).
- **Tauri Capability:** Explicit security grant required in Tauri v2 to expose native OS subsystem APIs to the webview sandbox.

### B. Version Compatibility Matrix

| Dependency                | Target Version    | Compatibility Status | Notes                                   |
| :------------------------ | :---------------- | :------------------- | :-------------------------------------- |
| `react` / `react-dom` | `^19.2.8`       | Supported            | Global`JSX` namespace removal handled |
| `i18next`               | `^24.x`         | Supported            | Core engine                             |
| `react-i18next`         | `^15.x / ^16.x` | Supported            | Full React 19 hooks compatibility       |
| `@tauri-apps/api`       | `^2.11.1`       | Supported            | Native Tauri v2 client                  |
| `@tauri-apps/plugin-os` | `^2.x`          | Supported            | Required for OS locale detection        |

### C. Raw Research Notes

- Static analysis of `package.json`: Project uses React 19.2.8 and Vite 7.
- Inspected `src-tauri/src/daemon/tray.rs`: menu is created via `TrayManager::build`. Re-applying `set_menu` with dynamic `Menu::with_items` replaces the native Win32 popup menu handle cleanly.

---

## Unresolved Questions

1. Should date/timestamp formats in `HistoryTab` (transcription history) also format according to the selected locale (e.g. `Intl.DateTimeFormat`), or remain ISO/relative? *(Recommended: Use `Intl.DateTimeFormat(currentLocale)`).*
2. Does the user want the AI Polish system prompt (`DEFAULT_POLISH_SYSTEM_PROMPT`) to adapt based on UI language, or remain bilingual Vietnamese-English? *(Current architecture intentionally preserves Vietnamese-English mixed tech priming regardless of UI language).*

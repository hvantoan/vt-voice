# Research: UI/UX Trends, Typography, Design System & Brand Identity

## 1. Executive Summary & Utility Benchmarks
- **Target**: High-performance Windows 11 voice-to-text utility (`vt-voice`) for developers.
- **Reference Benchmarks**:
  - **Wispr Flow**: Minimalist non-activating floating pill, real-time waveform bars reacting to mic RMS, instant state feedback.
  - **Raycast & Linear**: Frosted obsidian surfaces (`zinc-950/90`), 1px subtle borders (`zinc-800`), high-contrast typography, keyboard-first shortcut badges (`JetBrains Mono`).
  - **Warp & Windows 11 Fluent 2**: Precision dark elevation, Mica/Acrylic translucency, smooth micro-interactions, 8px/12px/pill radii.
- **Sources**: Linear Design System, Raycast UI Specs, Wispr Flow teardown, MS Fluent 2 Design Guidelines, Google Fonts Vietnamese unicode metrics.

## 2. Typography System & Vietnamese Support
- **Primary UI**: **Plus Jakarta Sans** (`weights: 400, 500, 600, 700`).
  - *Rationale*: Modern neo-grotesque, tall x-height for 12-14px desktop readability, native full Vietnamese diacritics support (`latin-ext`, `vietnamese`), zero glyph clipping when leading is `>= 1.4`.
- **Technical / Hotkey / Numbers**: **JetBrains Mono** (`weights: 500, 600`).
  - *Rationale*: Tabular numbers for latency stats and audio meters, distinct glyphs (`0` vs `O`, `1` vs `l`), compact hotkey badges (`Ctrl`, `Alt`, `Space`).
- **Font Stack Fallback**:
  - UI: `Plus Jakarta Sans, "Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif`
  - Mono: `JetBrains Mono, "Cascadia Code", Consolas, monospace`
- **Diacritics Safety Rule**: Line height for Vietnamese inputs MUST use `leading-relaxed` (`1.5`) or explicit `line-height: 1.45em` to prevent accent marks (e.g. `ễ`, `ệ`, `ở`, `ứ`) from colliding with upper bounds.

## 3. Dark Mode Color Tokens (Tailwind CSS Scale)
| Token Role | Tailwind Class | Hex Value | Purpose / Placement |
|---|---|---|---|
| **Canvas Background** | `bg-zinc-950` | `#09090b` | Base window background |
| **Card / Surface** | `bg-zinc-900/90` | `#18181b` | Settings cards, modal surfaces |
| **Hover / Elevated** | `bg-zinc-800/70` | `#27272a` | Card hover, dropdown items, input backgrounds |
| **Pill Overlay Surface** | `bg-zinc-950/85` | `#09090b` + `backdrop-blur-xl` | Floating non-activating indicator |
| **Border Subtle** | `border-zinc-800/80` | `#27272a` | 1px hairline card & window dividers |
| **Border Active/Focus** | `border-emerald-500/50` | `#10b981` | Focused inputs, active toggles |
| **Text Primary** | `text-zinc-100` | `#f4f4f5` | Headings, active values, transcription text |
| **Text Muted / Sub** | `text-zinc-400` | `#a1a1aa` | Labels, descriptions, secondary metadata |
| **Text Dim / Hotkey** | `text-zinc-500` | `#71717a` | Inactive icons, hotkey modifiers |
| **Accent Primary** | `bg-emerald-500` | `#10b981` | Core actions, success, toggle switches |
| **Accent Secondary** | `bg-indigo-500` | `#6366f1` | AI / LLM provider badges, prompt controls |
| **Status: Recording** | `text/bg-rose-500` | `#f43f5e` | Pulsing recording dot & live waveform bars |
| **Status: Processing** | `text/bg-amber-400` | `#fbbf24` | Transcription & grammar polishing spinner |
| **Status: Success** | `text/bg-emerald-400` | `#34d399` | "Pasted!" badge & clipboard confirm |
| **Status: Error** | `text/bg-rose-600` | `#e11d48` | Failed API, no mic, connection timeout |

## 4. Design System Tokens & Spatial Specs
- **Grid**: 4px baseline, 8px modular layout (`gap-2`, `gap-4`, `p-4`, `p-6`).
- **Radii**:
  - `rounded-md` (6px): Buttons, badge tags, hotkey chips.
  - `rounded-lg` (8px): Form inputs, select dropdowns.
  - `rounded-xl` (12px): Settings dashboard cards.
  - `rounded-full` (9999px): Floating overlay pill, audio level meter capsules, status beacons.
- **Elevation**:
  - Card: `border border-zinc-800/80 shadow-sm shadow-black/40`
  - Floating Pill: `shadow-2xl shadow-black/80 ring-1 ring-white/10 backdrop-blur-xl`
- **Floating Pill Dimensions & States**:
  - Geometry: Height `42px`, variable width `180px - 260px`, anchored bottom-center (`bottom: 64px`).
  - **State 1 (Listening)**: 8px `rose-500` pulsing beacon + 5 dynamic RMS waveform bars (2px width, 4px-20px height) + timer (`00:03` in `JetBrains Mono`).
  - **State 2 (Polishing)**: 14px `amber-400` spinning ring + "Polishing mixed text..." (`zinc-300`, 12px).
  - **State 3 (Success)**: 14px `emerald-400` check icon + "Pasted!" badge with 800ms auto-fade.

## 5. App Icon & Brand Asset Specification
- **Visual Concept**: "Sonic Spark" — A precision geometric capsule microphone intersected by a soundwave that sharpens into an electric lightning bolt, expressing instant voice-to-text speed.
- **Color Palette**: Dark obsidian background (`#09090b`) with an energetic gradient from Emerald-400 (`#34d399`) through Cyan-400 (`#22d3ee`) to Indigo-500 (`#6366f1`).
- **SVG Icon Asset Spec**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="sonicBolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="50%" stop-color="#22d3ee" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <!-- Rounded Squircle Base -->
  <rect x="8" y="8" width="112" height="112" rx="28" fill="#09090b" stroke="#27272a" stroke-width="2"/>
  <!-- Microphone Capsule Frame -->
  <rect x="48" y="26" width="32" height="50" rx="16" fill="none" stroke="url(#sonicBolt)" stroke-width="5" filter="url(#glow)"/>
  <!-- Soundwave / Lightning Cut -->
  <path d="M42 56 C42 68, 52 78, 64 78 C76 78, 86 68, 86 56 M64 78 L64 94 M50 94 L78 94 M60 38 L68 48 L61 51 L69 62" 
        fill="none" stroke="url(#sonicBolt)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```
- **Generative AI Prompt**:
  > "App icon for a developer voice-to-text utility named vt-voice, minimalist dark mode squircle, deep obsidian zinc-950 background, glowing neon gradient of emerald green, cyan, and electric indigo. Clean geometric icon combining a sleek capsule microphone with a dynamic soundwave transforming into an electric lightning bolt. Vector art, Apple macOS / Windows 11 Fluent style, 8k, crisp edges, subtle rim light."

## 6. Trade-off Matrix & Font Evaluation
| Option | Legibility (12-14px) | Mixed Vi-En Diacritics | Desktop Dev Aesthetic | Rank |
|---|---|---|---|---|
| **Plus Jakarta Sans + JetBrains Mono** | Exceptional | Native full support, zero clipping | Modern, developer-grade | **#1 (Recommended)** |
| **Inter + Fira Code** | High | Standard support, widely used | Common, slightly generic | **#2** |
| **Geist + Geist Mono** | High | Diacritic height quirks in WebKit | Ultra-minimalist Vercel style | **#3** |
| **Segoe UI Variable** | Good | Windows native, good diacritics | OS-bound, less branded | **#4** |

## 7. Adoption Risks & Architectural Fit
- **WebView2 Glassmorphism**: `backdrop-filter: blur(16px)` on Windows 11 with transparent Tauri windows requires hardware acceleration. Low-end integrated GPUs can experience redraw lag if overlay size is large.
  - *Mitigation*: Keep overlay pill strictly compact (`240x48px`), static opaque backdrop fallback (`zinc-950` with 95% opacity) if GPU acceleration is disabled.
- **Diacritics Collision**: Vietnamese marks like `?` (hỏi), `~` (ngã), `^` (mũ) can be clipped by tight `overflow: hidden` containers.
  - *Mitigation*: Standardize `py-1` and `leading-normal` or `leading-[1.45]` on all text wrappers.
- **Architectural Fit**: 100% aligned with Tauri v2 + React 19 + Tailwind CSS setup. Tokens translate directly to `tailwind.config.js`.

## 8. Limitations & Unresolved Questions
- **Limitations**: Research focuses on desktop dark mode; high-contrast accessibility themes (Windows Contrast Themes) are not covered in this phase.
- **Unresolved Question**: Should the floating overlay support a customizable screen anchor position (e.g., top-center or cursor-following) or remain strictly bottom-center above the Windows taskbar?

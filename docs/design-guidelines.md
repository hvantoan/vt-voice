# vt-voice Design Guidelines & Design System

> **Application**: `vt-voice` — Windows 11 Background Voice-to-Text Desktop Daemon  
> **Architecture**: Tauri v2 (Rust Backend) + React 19 + Tailwind CSS + Lucide Icons  
> **Design Vision**: Zero-distraction, ultra-responsive developer voice input with Windows 11 Mica / Acrylic aesthetics.

---

## 1. Design Philosophy & Core Principles

`vt-voice` is an ambient developer utility built to bridge spoken thought and code/documentation at the speed of thought. The UI must feel completely weightless, visually cohesive with Windows 11, and never interrupt the user's active focus or cursor in IDEs, terminals, or browsers.

### Principles
1. **Zero-Focus Stealing (Non-Activating)**: The floating overlay must never take foreground focus away from the active target application (Notepad, VS Code, Slack). Caret position and active selection remain 100% untouched.
2. **Instant Visual Feedback (< 50ms)**: When the global hotkey is pressed, the indicator must be visible immediately with dynamic audio waveform bars reflecting input volume.
3. **Subtle & Ambient**: When idle, `vt-voice` lives quietly in the Windows system tray with zero visual clutter. When triggered, it presents a compact, frosted glass pill above the taskbar.
4. **Developer-Grade Typography & Ergonomics**: Built with monospace clarity for technical parameters, hotkey glyphs, and latency telemetry, paired with high-legibility geometric sans for Vietnamese and English text.
5. **Robust Vietnamese Diacritics Safety**: Vietnamese technical communication requires full support for complex tone marks (hỏi, ngã, nặng, sắc, huyền) without upper or lower clipping.

---

## 2. Color System & Design Tokens

The visual theme is built on a modern obsidian / zinc dark scale with vibrant status accents and glassmorphism highlights.

### 2.1 Base Surface Tokens
| Token | Tailwind Class | Hex / Value | Usage & Application |
|---|---|---|---|
| `--surface-canvas` | `bg-zinc-950` | `#09090b` | Base desktop window background, app frame |
| `--surface-card` | `bg-zinc-900/90` | `#18181b` | Settings dashboard cards, modal surfaces |
| `--surface-elevated` | `bg-zinc-800/70` | `#27272a` | Input fields, dropdown triggers, chip backgrounds |
| `--surface-hover` | `bg-zinc-800` | `#27272a` | Button hover, list item highlight |
| `--surface-pill` | `bg-zinc-950/85` | `rgba(9, 9, 11, 0.85)` | Floating overlay pill with `backdrop-blur-xl` |
| `--border-subtle` | `border-zinc-800/80` | `rgba(39, 39, 42, 0.8)` | Hairline dividers, card outlines |
| `--border-focus` | `border-emerald-500/60`| `rgba(16, 185, 129, 0.6)`| Active focus ring, input highlight |
| `--border-glass` | `border-white/10` | `rgba(255, 255, 255, 0.10)` | Translucent rim light on floating elements |

### 2.2 Typography Colors
| Token | Tailwind Class | Hex Value | Usage |
|---|---|---|---|
| `--text-primary` | `text-zinc-100` | `#f4f4f5` | Headings, active values, transcription text |
| `--text-secondary` | `text-zinc-400` | `#a1a1aa` | Labels, descriptions, secondary metadata |
| `--text-muted` | `text-zinc-500` | `#71717a` | Inactive icons, hotkey modifiers, timestamps |
| `--text-accent` | `text-emerald-400` | `#34d399` | Success notifications, primary action badges |

### 2.3 Semantic Status Colors
| State | Accent Token | Hex Value | Visual Elements |
|---|---|---|---|
| **Recording / Listening** | `rose-500` | `#f43f5e` | Pulsing recording beacon, real-time waveform bars |
| **Processing / Polishing**| `amber-400` | `#fbbf24` | Spinning progress ring, "Polishing grammar..." text |
| **Success / Pasted** | `emerald-400` | `#34d399` | Checkmark glyph, "Pasted!" flash notification |
| **Error / Alert** | `rose-600` | `#e11d48` | Alert badge, error toast, retry button |
| **AI / Cloud Badge** | `indigo-500` | `#6366f1` | Provider badges (Groq, Llama-3.3, Whisper) |
| **Local / Offline** | `sky-500` | `#0ea5e9` | whisper-rs, Ollama offline indicators |

---

## 3. Typography System & Vietnamese Support

### 3.1 Font Families
- **Primary UI Font**: `Plus Jakarta Sans` (`weights: 400, 500, 600, 700`)  
  *Fallback*: `"Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif`  
  *Rationale*: Geometric sans-serif with tall x-height, wide apertures, and full native support for Vietnamese Latin Extended-B unicode ranges.
- **Monospace / Technical Font**: `JetBrains Mono` (`weights: 500, 600`)  
  *Fallback*: `"Cascadia Code", Consolas, monospace`  
  *Rationale*: Tabular numerals for latency counters, distinct glyphs (`0` with dot, clear `1` vs `l`), compact badge formatting for key combinations (`Ctrl`, `Alt`, `Space`).

### 3.2 Diacritics Safety Rules (Vietnamese Language)
Vietnamese vowel tones (e.g., `ễ`, `ệ`, `ở`, `ứ`, `đ`, `à`) have extended ascenders and descenders. To prevent vertical clipping:
1. **Container Line Height**: Never use `leading-none` or `leading-tight` on containers holding transcribed text or user inputs. Standardize on `leading-normal` (`1.5`) or `leading-relaxed` (`1.625`).
2. **Vertical Padding**: Inputs and labels must maintain a minimum `py-2` (8px) padding to accommodate diacritical tone marks.
3. **Overflow Handling**: Avoid `overflow-hidden` on inline spans containing accented Vietnamese text.

### 3.3 Typographic Hierarchy
| Role | Font Size | Weight | Line Height | Letter Spacing | Font Family |
|---|---|---|---|---|---|
| **Window Title** | `15px` (`text-sm`) | 600 (Semibold) | 1.4 | `-0.01em` | Plus Jakarta Sans |
| **Section Header**| `18px` (`text-lg`) | 600 (Semibold) | 1.3 | `-0.02em` | Plus Jakarta Sans |
| **Card Title** | `14px` (`text-sm`) | 600 (Semibold) | 1.4 | `-0.01em` | Plus Jakarta Sans |
| **Body / Labels** | `13px` (`text-xs`) | 400 / 500 | 1.5 | `normal` | Plus Jakarta Sans |
| **Helper Text** | `12px` (`text-[12px]`) | 400 (Regular) | 1.5 | `normal` | Plus Jakarta Sans |
| **Hotkey Badge** | `11px` (`text-[11px]`) | 600 (Semibold) | 1.0 | `+0.04em` | JetBrains Mono |
| **Telemetry / Stat**| `12px` (`text-xs`) | 500 (Medium) | 1.0 | `tabular-nums` | JetBrains Mono |

---

## 4. Layout, Radii & Elevation

### 4.1 Spatial Rhythm
- Base modular unit: **4px**
- Common spacing increments: `4px` (`p-1`), `8px` (`p-2`), `12px` (`p-3`), `16px` (`p-4`), `24px` (`p-6`).
- Settings window dimensions: **720px wide × 560px high** (Fixed desktop frame, non-resizable or smoothly adaptive).
- Floating Overlay dimensions: **240px wide × 44px high** (Expanding to max 280px during error or long state labels).

### 4.2 Corner Radii
- `rounded-md` (**6px**): Hotkey badges, small buttons, status chips.
- `rounded-lg` (**8px**): Text inputs, select menus, toggle switches.
- `rounded-xl` (**12px**): Settings cards, dialog panels, toast notifications.
- `rounded-full` (**9999px**): Floating pill overlay, audio meter capsules, status dots.

### 4.3 Windows 11 Mica & Acrylic Simulation
In web rendering, the Windows 11 fluent dark material is achieved via layered translucency:
```css
/* Windows 11 Frosted Acrylic Spec */
.win11-acrylic {
  background-color: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.6),
              inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
}
```

---

## 5. Component Specifications

### 5.1 Component 1: Floating Pill Overlay
The overlay is a dedicated Tauri WebView2 window anchored to the bottom-center of the active screen (`bottom: 64px`), positioned directly above the Windows 11 taskbar.

#### Win32 Native Characteristics
- Window Flags: `WS_EX_NOACTIVATE (0x08000000)`, `WS_EX_TRANSPARENT (0x00000020)`, `WS_EX_TOOLWINDOW (0x00000080)`, `WS_EX_TOPMOST (0x00000008)`.
- Invocation: `ShowWindow(hwnd, SW_SHOWNOACTIVATE)`.
- Click-through: `set_ignore_cursor_events(true)` allows users to click items underneath the overlay without obstruction.

#### Dimensions & Structure
- Width: `240px - 280px`
- Height: `44px`
- Padding: `px-4 py-2`
- Shape: Full pill (`rounded-full`)

#### State Machine Matrix
| State | Left Indicator | Center Label | Right Visualizer | Audio Feedback |
|---|---|---|---|---|
| **1. Listening** | Pulsing `rose-500` dot (8px) | `"Listening..."` (zinc-200, 12px) | 5 dynamic audio wave bars reacting to mic RMS | Chime start (optional) |
| **2. Processing**| Spinning `amber-400` SVG ring (14px) | `"Polishing grammar..."` | Shimmering text gradient / subtle pulse | None |
| **3. Pasted (Success)** | Animated `emerald-400` checkmark (14px)| `"Pasted!"` (emerald-300, 12px) | Green confirmation glow, auto-dismisses in 800ms | Chime complete (optional)|
| **4. Error** | `rose-500` alert circle (14px) | `"API Rate Limit"` or `"No Mic"` | Error icon / dismiss hint | Error tone |
| **5. Idle** | Hidden (`opacity-0`, `pointer-events-none`, window hidden) | None | None | None |

#### Dynamic Audio Waveform Visualizer
The right side of the pill features 5 vertical audio bars:
- Bar width: `2.5px`, Bar gap: `2.5px`, Bar radius: `1px`.
- Inactive height: `4px` (`bg-rose-500/40`).
- Active range: `4px` to `20px` dynamic height proportional to calculated WASAPI audio RMS.
- Color: Gradient from `rose-400` to `rose-500` with soft glow.

---

### 5.2 Component 2: Settings Window
A 720×560px dark dashboard organized with a fixed 200px left sidebar and 520px content area.

#### Navigation Tabs
1. **General**:
   - Hotkey Mode Selection (Segmented control: "Hold to Talk (Push-to-Talk)" vs "Toggle to Talk").
   - Hotkey Keybind Recorder (Interactive capture button for keys like `Right Alt`, `Ctrl+Space`, `F8`).
   - Launch Behaviors (Autostart on Windows boot, Start Minimized to Tray).
   - Audio feedback toggles (Subtle chime on record start/finish).
2. **Audio**:
   - WASAPI Input Microphone selector dropdown (lists real audio devices).
   - Live Audio Input Meter (animated real-time RMS gauge showing current noise floor).
   - VAD (Voice Activity Detection) Silence Timeout slider (range: 300ms - 2500ms, default 700ms).
   - Audio format telemetry badge (`16kHz Mono 16-bit PCM / WAV`).
3. **AI & Models**:
   - Provider Selector (Groq Cloud [Ultra-Fast, Recommended], OpenAI Whisper, Local Ollama / whisper-rs).
   - API Key Input:
     - Password obfuscation with show/hide toggle.
     - Windows Credential Manager (DPAPI) encrypted storage badge.
     - "Test Connection" button with real-time ping simulation & latency badge.
   - Model Selection:
     - STT Model: `whisper-large-v3-turbo` (~200ms latency) vs `whisper-large-v3`.
     - LLM Polish Model: `llama-3.3-70b-versatile` (~280ms latency).
   - System Prompt Editor for Vietnamese-English code-switching text polish:
     - Textarea with character counter and reset to default button.
   - Custom Vocabulary Tags (e.g., `k8s`, `PR`, `deploy`, `staging`, `refactor`, `API`) with tag input & chips.
4. **Transcription History & Logs**:
   - Search & filter bar.
   - History item list:
     - Timestamp (`2 mins ago`), duration (`3.4s`), audio size (`108 KB`).
     - Raw speech preview vs Polished output.
     - Latency breakdown chips: `STT 210ms` + `LLM 282ms` = `Total 492ms`.
     - 1-click copy button with visual feedback.
   - Export History (JSON/CSV) & Clear History actions.

---

## 6. Micro-Interactions & Animation Specs

1. **Overlay Entrance / Exit**:
   - Entrance: `translate-y-2 -> translate-y-0`, `opacity-0 -> opacity-100`, duration `150ms`, easing `cubic-bezier(0.16, 1, 0.3, 1)`.
   - Exit: `opacity-100 -> opacity-0`, `translate-y-0 -> translate-y-1`, duration `180ms`.
2. **Waveform Bar Reactivity**:
   - Transition duration `60ms ease-out` for snappy response to voice transients without jitter.
3. **Toggle Switches**:
   - Thumb translation: `translateX(18px)`, duration `180ms cubic-bezier(0.4, 0, 0.2, 1)`.
   - Track color transition: `bg-zinc-800` to `bg-emerald-500`.
4. **Button Press**:
   - `active:scale-[0.98]` with `transition-transform duration-100`.
5. **Shimmer Polish Effect**:
   - Linear gradient sweep (`background-size: 200% 100%`) across "Polishing grammar..." text with 1.5s loop.

---

## 7. Accessibility & Ergonomics Standards

- **Color Contrast (WCAG 2.1 AA)**:
  - Normal text (`text-zinc-100` #f4f4f5 on `bg-zinc-900` #18181b) has a contrast ratio of **13.8:1** (exceeds 4.5:1 requirement).
  - Secondary text (`text-zinc-400` #a1a1aa on `bg-zinc-900` #18181b) has a contrast ratio of **6.2:1**.
- **Keyboard Navigation**:
  - Visible focus rings with `ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950` on all interactive controls.
  - Tab order matches visual reading hierarchy (Sidebar tabs -> Main controls -> Footer actions).
- **Reduced Motion**:
  - Respect `@media (prefers-reduced-motion: reduce)`: disable pulse effects and replace waveform bar bouncing with a solid recording indicator.
- **Screen Reader Support**:
  - `aria-live="polite"` on overlay state announcements.
  - `role="status"` on latency indicators and test connection badges.

---

## 8. Brand Identity & App Icon Specification

### Concept: "Sonic Spark"
A precision geometric capsule microphone intersected by an electric soundwave that sharpens into a lightning bolt, symbolizing instant zero-latency speech-to-text.

- **Primary Colors**: Obsidian (`#09090b`), Emerald-400 (`#34d399`), Cyan-400 (`#22d3ee`), Indigo-500 (`#6366f1`).
- **Icon Dimensions**: 128×128px SVG squircle with Windows 11 desktop and tray compatibility.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="sonicGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="50%" stop-color="#22d3ee" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="112" height="112" rx="28" fill="#09090b" stroke="#27272a" stroke-width="2"/>
  <rect x="48" y="26" width="32" height="50" rx="16" fill="none" stroke="url(#sonicGlow)" stroke-width="5"/>
  <path d="M42 56 C42 68, 52 78, 64 78 C76 78, 86 68, 86 56 M64 78 L64 94 M50 94 L78 94 M60 38 L68 48 L61 51 L69 62" 
        fill="none" stroke="url(#sonicGlow)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

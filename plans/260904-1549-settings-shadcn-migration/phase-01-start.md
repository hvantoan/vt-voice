---
phase: 1
title: "Infrastructure, Path Aliases & Fluent Acrylic Design Tokens"
status: pending
priority: P1
effort: "1h"
dependencies: []
---
# Phase 1: Infrastructure, Path Aliases & Fluent Acrylic Design Tokens

## Overview

Establish the shadcn/ui foundation for `vt-voice`: configure TypeScript and Vite path aliases (`@/*`), scaffold `components.json`, implement the `cn` utility function, and define custom CSS variable tokens in `index.css` and `tailwind.config.js` that integrate seamlessly with the existing Windows 11 Fluent Acrylic backdrop blur.

## Requirements

- Functional:
  - `@/*` path mapping resolves to `./src/*` across TypeScript compiler and Vite bundler.
  - `components.json` configured for React + Vite + Tailwind v3 with zinc base color.
  - `src/lib/utils.ts` exports `cn(...inputs: ClassValue[])` combining `clsx` and `tailwind-merge`.
- Non-functional:
  - Preserve dark-mode default (`color-scheme: dark`) and existing `.win11-acrylic` / `.win11-pill` utility classes.
  - Ensure card and popover background variables support alpha transparency (e.g. `rgba(24, 24, 27, 0.75)` or equivalent HSL with opacity) so acrylic blur shines through.

## Architecture

```
tsconfig.json  ──> baseUrl: ".", paths: { "@/*": ["./src/*"] }
vite.config.ts ──> resolve.alias: { "@": path.resolve(__dirname, "./src") }
components.json──> defines aliases (@/components/ui, @/lib/utils, @/components)
src/index.css  ──> :root (dark mode theme variables, translucent popovers/cards)
tailwind.config──> extend colors with hsl(var(--...)) + tailwindcss-animate
```

## Related Code Files

- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: `tailwind.config.js`
- Modify: `src/index.css`
- Create: `components.json`
- Create: `src/lib/utils.ts`

## Implementation Steps

1. **Configure TypeScript Path Alias:**
   - Update `tsconfig.json`: add `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }` to `compilerOptions`.
2. **Configure Vite Path Alias:**
   - In `vite.config.ts`, import `path` from `"path"` and add `resolve: { alias: { "@": path.resolve(__dirname, "./src") } }`.
3. **Create `src/lib/utils.ts`:**
   - Implement:
     ```ts
     import { clsx, type ClassValue } from "clsx";
     import { twMerge } from "tailwind-merge";

     export function cn(...inputs: ClassValue[]) {
       return twMerge(clsx(inputs));
     }
     ```
4. **Scaffold `components.json`:**
   - Add shadcn configuration pointing to `./src/components/ui`, `./src/lib/utils`, and `./src/index.css` with `rsc: false`, `tsx: true`, `tailwind.config: "tailwind.config.js"`, `tailwind.css: "src/index.css"`, and `aliases`.
5. **Update Tailwind & CSS Variables:**
   - Add `tailwindcss-animate` if needed or configure standard shadcn keyframes for popovers/dropdowns.
   - Extend `tailwind.config.js` with semantic color tokens (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`).
   - In `src/index.css`, define dark theme CSS variables, ensuring card and popover tokens blend into the acrylic backdrop rather than rendering solid black.
6. **Verify Build:**
   - Run `bun run build` to verify path resolution and style compilation.

## Success Criteria

- [x] `import { cn } from "@/lib/utils"` compiles without TypeScript errors.
- [x] `bun run build` completes successfully with 0 errors.
- [x] `components.json` passes validation when querying via shadcn CLI.
- [x] Acrylic blur styling remains visually intact on the Settings window.

## Risk Assessment

- **Risk:** Radix UI or shadcn popover solid backgrounds block the `.win11-acrylic` backdrop blur.
  - *Observable signal:* Dropdowns or cards display an opaque pitch-black rectangle with sharp contrast against the translucent window.
  - *Pre-decided response:* Adjust `--popover` and `--card` to include an 80-85% alpha channel (`hsla(...)` or `rgba(...)`) and add `backdrop-blur-md` to popover base classes.

import React, { useState, useEffect, useRef } from "react";
import { Key, Mouse } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface KeyBinding {
  code: number;
  name: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
}

export interface HotkeyRecorderProps {
  value: KeyBinding;
  onChange: (binding: KeyBinding) => void;
  hasError?: boolean;
  allowSingleModifier?: boolean;
}
export const DEFAULT_HOTKEY_BINDING: KeyBinding = {
  code: 0xa5,
  name: "Right Alt",
  ctrl: false,
  alt: false,
  shift: false,
  win: false,
};

export const DEFAULT_TRANSLATE_BINDING: KeyBinding = {
  code: 0x54,
  name: "T",
  ctrl: false,
  alt: true,
  shift: false,
  win: false,
};

export const isSameBinding = (a: KeyBinding, b: KeyBinding): boolean => {
  return (
    a.code === b.code &&
    !!a.ctrl === !!b.ctrl &&
    !!a.alt === !!b.alt &&
    !!a.shift === !!b.shift &&
    !!a.win === !!b.win
  );
};

function getCleanKeyName(name: string): string {
  if (!name) return "";
  if (name.includes("+")) {
    const parts = name.split("+").map((p) => p.trim());
    return parts[parts.length - 1] || name;
  }
  return name;
}


const MODIFIER_CODES: Record<string, true> = {
  ControlLeft: true,
  ControlRight: true,
  AltLeft: true,
  AltRight: true,
  AltGraph: true,
  ShiftLeft: true,
  ShiftRight: true,
  MetaLeft: true,
  MetaRight: true,
};

const STANDALONE_MODIFIERS: Record<string, { code: number; name: string }> = {
  AltRight: { code: 0xa5, name: "Right Alt" },
  AltLeft: { code: 0xa4, name: "Left Alt" },
  AltGraph: { code: 0xa5, name: "Right Alt" },
  ControlRight: { code: 0xa3, name: "Right Ctrl" },
  ControlLeft: { code: 0xa2, name: "Left Ctrl" },
  ShiftRight: { code: 0xa1, name: "Right Shift" },
  ShiftLeft: { code: 0xa0, name: "Left Shift" },
  MetaLeft: { code: 0x5b, name: "Win" },
  MetaRight: { code: 0x5c, name: "Right Win" },
  CapsLock: { code: 0x14, name: "CapsLock" },
};

const SPECIAL_KEYS: Record<string, { code: number; name: string }> = {
  Space: { code: 0x20, name: "Space" },
  Tab: { code: 0x09, name: "Tab" },
  Enter: { code: 0x0d, name: "Enter" },
  Backspace: { code: 0x08, name: "Backspace" },
  Insert: { code: 0x2d, name: "Insert" },
  Delete: { code: 0x2e, name: "Delete" },
  Home: { code: 0x24, name: "Home" },
  End: { code: 0x23, name: "End" },
  PageUp: { code: 0x21, name: "Page Up" },
  PageDown: { code: 0x22, name: "Page Down" },
  PrintScreen: { code: 0x2c, name: "Print Screen" },
  ScrollLock: { code: 0x91, name: "Scroll Lock" },
  Pause: { code: 0x13, name: "Pause" },
  NumLock: { code: 0x90, name: "Num Lock" },
  NumpadMultiply: { code: 0x6a, name: "Num *" },
  NumpadAdd: { code: 0x6b, name: "Num +" },
  NumpadSubtract: { code: 0x6d, name: "Num -" },
  NumpadDecimal: { code: 0x6e, name: "Num ." },
  NumpadDivide: { code: 0x6f, name: "Num /" },
  Backquote: { code: 0xc0, name: "`" },
  Minus: { code: 0xbd, name: "-" },
  Equal: { code: 0xbb, name: "=" },
  BracketLeft: { code: 0xdb, name: "[" },
  BracketRight: { code: 0xdd, name: "]" },
  Backslash: { code: 0xdc, name: "\\" },
  Semicolon: { code: 0xba, name: ";" },
  Quote: { code: 0xde, name: "'" },
  Comma: { code: 0xbc, name: "," },
  Period: { code: 0xbe, name: "." },
  Slash: { code: 0xbf, name: "/" },
  ArrowUp: { code: 0x26, name: "Up" },
  ArrowDown: { code: 0x28, name: "Down" },
  ArrowLeft: { code: 0x25, name: "Left" },
  ArrowRight: { code: 0x27, name: "Right" },
};

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({
  value,
  onChange,
  hasError,
  allowSingleModifier = true,
}) => {
  const { t } = useI18n();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [activeModifiers, setActiveModifiers] = useState({
    ctrl: false,
    alt: false,
    shift: false,
    win: false,
  });

  const heldModifiersRef = useRef({
    ctrl: false,
    alt: false,
    shift: false,
    win: false,
  });
  const maxModifiersCountRef = useRef<number>(0);
  const lastDownCodeRef = useRef<string | null>(null);
  const hadNonModifierRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isRecording) return;

    heldModifiersRef.current = {
      ctrl: false,
      alt: false,
      shift: false,
      win: false,
    };
    maxModifiersCountRef.current = 0;
    setActiveModifiers({
      ctrl: false,
      alt: false,
      shift: false,
      win: false,
    });
    lastDownCodeRef.current = null;
    hadNonModifierRef.current = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      lastDownCodeRef.current = e.code;

      const isCtrl = e.ctrlKey || e.code === "ControlLeft" || e.code === "ControlRight" || heldModifiersRef.current.ctrl;
      const isAlt = e.altKey || e.code === "AltLeft" || e.code === "AltRight" || e.code === "AltGraph" || heldModifiersRef.current.alt;
      const isShift = e.shiftKey || e.code === "ShiftLeft" || e.code === "ShiftRight" || heldModifiersRef.current.shift;
      const isWin = e.metaKey || e.code === "MetaLeft" || e.code === "MetaRight" || heldModifiersRef.current.win;

      heldModifiersRef.current = {
        ctrl: isCtrl,
        alt: isAlt,
        shift: isShift,
        win: isWin,
      };

      const countMods = (isCtrl ? 1 : 0) + (isAlt ? 1 : 0) + (isShift ? 1 : 0) + (isWin ? 1 : 0);
      if (countMods > maxModifiersCountRef.current) {
        maxModifiersCountRef.current = countMods;
      }

      setActiveModifiers({ ctrl: isCtrl, alt: isAlt, shift: isShift, win: isWin });

      // If it's only a modifier key being pressed down, wait to see if it's followed by another key
      if (MODIFIER_CODES[e.code]) {
        return;
      }

      hadNonModifierRef.current = true;

      // Determine virtual key code and friendly name for the key
      let code = e.keyCode;
      let name = e.key;

      if (SPECIAL_KEYS[e.code]) {
        code = SPECIAL_KEYS[e.code].code;
        name = SPECIAL_KEYS[e.code].name;
      } else if (e.code.startsWith("Key")) {
        name = e.code.slice(3).toUpperCase();
      } else if (e.code.startsWith("Digit")) {
        name = e.code.slice(5);
      } else if (e.code.startsWith("Numpad")) {
        name = `Num ${e.code.slice(6)}`;
      } else if (e.code.startsWith("F") && e.code.length <= 3) {
        name = e.code;
      }

      // Format a clean combo name (e.g. "Alt + T", "Ctrl + Shift + S")
      let displayName = name;
      if (isCtrl || isAlt || isShift || isWin) {
        const parts: string[] = [];
        if (isCtrl && !name.includes("Ctrl")) parts.push("Ctrl");
        if (isAlt && !name.includes("Alt")) parts.push("Alt");
        if (isShift && !name.includes("Shift")) parts.push("Shift");
        if (isWin && !name.includes("Win")) parts.push("Win");
        parts.push(name);
        displayName = parts.join(" + ");
      }

      onChange({
        code,
        name: displayName,
        ctrl: isCtrl,
        alt: isAlt,
        shift: isShift,
        win: isWin,
      });
      setIsRecording(false);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // If no non-modifier key was pressed during this recording session
      if (!hadNonModifierRef.current && lastDownCodeRef.current) {
        const releasedStandalone = STANDALONE_MODIFIERS[e.code];
        if (releasedStandalone) {
          // Check if multiple modifiers were held together (e.g. Ctrl + Shift, Alt + Shift)
          if (maxModifiersCountRef.current > 1) {
            const isCtrl = heldModifiersRef.current.ctrl && !releasedStandalone.name.includes("Ctrl");
            const isAlt = heldModifiersRef.current.alt && !releasedStandalone.name.includes("Alt");
            const isShift = heldModifiersRef.current.shift && !releasedStandalone.name.includes("Shift");
            const isWin = heldModifiersRef.current.win && !releasedStandalone.name.includes("Win");

            onChange({
              code: releasedStandalone.code,
              name: releasedStandalone.name.replace(/^(Left|Right)\s*/, ""),
              ctrl: isCtrl,
              alt: isAlt,
              shift: isShift,
              win: isWin,
            });
            setIsRecording(false);
            return;
          }

          // Single standalone modifier (e.g. Right Alt, CapsLock, Left Ctrl)
          // Only allowed when allowSingleModifier is true (Voice typing)
          if (allowSingleModifier) {
            onChange({
              code: releasedStandalone.code,
              name: releasedStandalone.name,
              ctrl: false,
              alt: false,
              shift: false,
              win: false,
            });
            setIsRecording(false);
            return;
          }
        }
      }

      // Update remaining active modifiers
      const isCtrl = e.ctrlKey && e.code !== "ControlLeft" && e.code !== "ControlRight";
      const isAlt = e.altKey && e.code !== "AltLeft" && e.code !== "AltRight" && e.code !== "AltGraph";
      const isShift = e.shiftKey && e.code !== "ShiftLeft" && e.code !== "ShiftRight";
      const isWin = e.metaKey && e.code !== "MetaLeft" && e.code !== "MetaRight";
      setActiveModifiers({
        ctrl: isCtrl,
        alt: isAlt,
        shift: isShift,
        win: isWin,
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Left click is ignored here so user can click "Hủy" or cancel
      if (e.button === 0) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      let code = 0;
      let name = "";

      if (e.button === 3) {
        // Browser Back / XButton 1 / Mouse 4
        code = 0x05;
        name = "Mouse 4";
      } else if (e.button === 4) {
        // Browser Forward / XButton 2 / Mouse 5
        code = 0x06;
        name = "Mouse 5";
      } else if (e.button === 1) {
        // Middle Mouse / Mouse 3
        code = 0x04;
        name = "Mouse 3";
      }

      if (code !== 0) {
        const isCtrl = e.ctrlKey || heldModifiersRef.current.ctrl;
        const isAlt = e.altKey || heldModifiersRef.current.alt;
        const isShift = e.shiftKey || heldModifiersRef.current.shift;
        const isWin = e.metaKey || heldModifiersRef.current.win;

        // Single mouse button or combo with modifiers
        onChange({
          code,
          name,
          ctrl: isCtrl,
          alt: isAlt,
          shift: isShift,
          win: isWin,
        });
        setIsRecording(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

      // Do not cancel on blur because pressing Alt in Windows WebView2 causes a transient blur
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("auxclick", handleMouseDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);


    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("auxclick", handleMouseDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);

    };
  }, [isRecording, onChange]);

  const isMouseKey = value.code === 0x04 || value.code === 0x05 || value.code === 0x06;

  const cleanName = getCleanKeyName(value.name);

  const keysList: string[] = [];
  if (value.ctrl && !cleanName.toLowerCase().includes("ctrl")) keysList.push("Ctrl");
  if (value.alt && !cleanName.toLowerCase().includes("alt")) keysList.push("Alt");
  if (value.shift && !cleanName.toLowerCase().includes("shift")) keysList.push("Shift");
  if (value.win && !cleanName.toLowerCase().includes("win")) keysList.push("Win");
  if (cleanName) keysList.push(cleanName);

  const activeModifierList = [
    activeModifiers.ctrl ? "Ctrl" : "",
    activeModifiers.alt ? "Alt" : "",
    activeModifiers.shift ? "Shift" : "",
    activeModifiers.win ? "Win" : "",
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsRecording(true)}
        className={cn(
          "group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono tabular-nums border transition-all cursor-pointer select-none",
          isRecording
            ? "bg-rose-500/15 border-rose-500/80 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)] animate-pulse"
            : hasError
              ? "bg-rose-500/10 border-rose-500/60 text-rose-300 hover:bg-rose-500/20"
              : "bg-zinc-900/90 border-zinc-700/70 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500 hover:text-white"
        )}
        title={t("hotkey.tooltip")}
      >
        {isMouseKey ? (
          <Mouse className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <Key className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
        )}
        {isRecording ? (
          <span className="font-sans text-xs text-rose-300 flex items-center gap-1">
            {activeModifierList.length > 0 ? (
              <>
                {activeModifierList.map((mod, idx) => (
                  <React.Fragment key={idx}>
                    <kbd className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-[10px] font-mono text-rose-200">
                      {mod}
                    </kbd>
                    <span className="text-[10px] text-rose-400 font-mono">+</span>
                  </React.Fragment>
                ))}
                <span className="text-[11px] italic text-rose-300">...</span>
              </>
            ) : (
              <span>{t("hotkey.press_key")}</span>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            {keysList.length > 0 ? (
              keysList.map((k, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-[10px] text-zinc-500 font-mono">+</span>}
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-[11px] font-mono font-medium text-zinc-200 shadow-sm group-hover:border-zinc-600 transition-colors">
                    {k}
                  </kbd>
                </React.Fragment>
              ))
            ) : (
              <span className="text-zinc-500">{t("hotkey.unassigned")}</span>
            )}
          </span>
        )}
      </button>

      {isRecording && (
        <button
          type="button"
          onClick={() => setIsRecording(false)}
          className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:underline cursor-pointer transition-colors px-1"
        >
          {t("hotkey.cancel")}
        </button>
      )}
    </div>
  );
};

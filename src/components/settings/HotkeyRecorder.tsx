import React, { useState, useEffect, useRef } from "react";
import { Key, Mouse } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface KeyBinding {
  code: number;
  name: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
}

interface HotkeyRecorderProps {
  value: KeyBinding;
  onChange: (binding: KeyBinding) => void;
}

export interface PresetBinding {
  key: string;
  defaultLabel: string;
  binding: KeyBinding;
}

export const PRESET_BINDINGS: PresetBinding[] = [
  {
    key: "hotkey.presets.right_alt",
    defaultLabel: "Right Alt",
    binding: { code: 0xa5, name: "Right Alt", ctrl: false, alt: false, shift: false, win: false },
  },
  {
    key: "hotkey.presets.mouse_4",
    defaultLabel: "Mouse 4",
    binding: { code: 0x05, name: "Mouse 4", ctrl: false, alt: false, shift: false, win: false },
  },
  {
    key: "hotkey.presets.mouse_5",
    defaultLabel: "Mouse 5",
    binding: { code: 0x06, name: "Mouse 5", ctrl: false, alt: false, shift: false, win: false },
  },
  {
    key: "hotkey.presets.middle_mouse",
    defaultLabel: "Mouse 3",
    binding: { code: 0x04, name: "Mouse 3", ctrl: false, alt: false, shift: false, win: false },
  },
  {
    key: "hotkey.presets.ctrl_space",
    defaultLabel: "Ctrl + Space",
    binding: { code: 0x20, name: "Space", ctrl: true, alt: false, shift: false, win: false },
  },
  {
    key: "hotkey.presets.f7",
    defaultLabel: "F7",
    binding: { code: 0x76, name: "F7", ctrl: false, alt: false, shift: false, win: false },
  },
];

const MODIFIER_CODES: Record<string, true> = {
  ControlLeft: true,
  ControlRight: true,
  AltLeft: true,
  AltRight: true,
  ShiftLeft: true,
  ShiftRight: true,
  MetaLeft: true,
  MetaRight: true,
};

const STANDALONE_MODIFIERS: Record<string, { code: number; name: string }> = {
  AltRight: { code: 0xa5, name: "Right Alt" },
  AltLeft: { code: 0xa4, name: "Left Alt" },
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

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({ value, onChange }) => {
  const { t } = useI18n();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [activeModifiers, setActiveModifiers] = useState({
    ctrl: false,
    alt: false,
    shift: false,
    win: false,
  });

  const lastDownCodeRef = useRef<string | null>(null);
  const hadNonModifierRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isRecording) return;

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

      const ctrl = e.ctrlKey || e.code === "ControlLeft" || e.code === "ControlRight";
      const alt = e.altKey || e.code === "AltLeft" || e.code === "AltRight";
      const shift = e.shiftKey || e.code === "ShiftLeft" || e.code === "ShiftRight";
      const win = e.metaKey || e.code === "MetaLeft" || e.code === "MetaRight";

      setActiveModifiers({ ctrl, alt, shift, win });

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

      // If user is holding modifiers, it's a combination; if not, it's a single key!
      onChange({
        code,
        name,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        win: e.metaKey,
      });

      setIsRecording(false);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // If a standalone modifier key was tapped (pressed and released without any other key)
      if (!hadNonModifierRef.current && lastDownCodeRef.current === e.code) {
        const standalone = STANDALONE_MODIFIERS[e.code];
        if (standalone) {
          onChange({
            code: standalone.code,
            name: standalone.name,
            ctrl: false,
            alt: false,
            shift: false,
            win: false,
          });
          setIsRecording(false);
          return;
        }
      }

      // Update remaining active modifiers
      setActiveModifiers({
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        win: e.metaKey,
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Left click is ignored here so user can click "Hủy" or presets
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
        // Single mouse button or combo with modifiers
        onChange({
          code,
          name,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          win: e.metaKey,
        });
        setIsRecording(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleBlur = () => {
      setIsRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("auxclick", handleMouseDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("auxclick", handleMouseDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isRecording, onChange]);

  const isMouseKey = value.code === 0x04 || value.code === 0x05 || value.code === 0x06;

  const displayString = [
    value.ctrl ? "Ctrl" : "",
    value.alt ? "Alt" : "",
    value.shift ? "Shift" : "",
    value.win ? "Win" : "",
    value.name,
  ]
    .filter(Boolean)
    .join(" + ");

  const activeModifierString = [
    activeModifiers.ctrl ? "Ctrl" : "",
    activeModifiers.alt ? "Alt" : "",
    activeModifiers.shift ? "Shift" : "",
    activeModifiers.win ? "Win" : "",
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsRecording(true)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono border transition-all ${
            isRecording
              ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.2)]"
              : "bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:bg-zinc-700/80 hover:border-zinc-600 hover:text-white"
          }`}
          title={t("hotkey.tooltip")}
        >
          {isMouseKey ? (
            <Mouse className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Key className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <span>
            {isRecording
              ? activeModifierString
                ? `${activeModifierString} + ...`
                : t("hotkey.press_key")
              : displayString || t("hotkey.unassigned")}
          </span>
        </button>

        {isRecording && (
          <button
            type="button"
            onClick={() => setIsRecording(false)}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
          >
            {t("hotkey.cancel")}
          </button>
        )}
      </div>

      {/* Quick Presets for Mouse & Common Keys */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] text-zinc-400 mr-1 font-medium">{t("hotkey.presets_label")}</span>
        {PRESET_BINDINGS.map((preset) => {
          const isSelected =
            value.code === preset.binding.code &&
            value.ctrl === preset.binding.ctrl &&
            value.alt === preset.binding.alt &&
            value.shift === preset.binding.shift &&
            value.win === preset.binding.win;

          return (
            <button
              key={preset.defaultLabel}
              type="button"
              onClick={() => {
                onChange(preset.binding);
                setIsRecording(false);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                isSelected
                  ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-semibold"
                  : "bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
              }`}
            >
              {t(preset.key) || preset.defaultLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};

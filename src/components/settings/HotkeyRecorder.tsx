import React, { useState, useEffect } from "react";
import { Key } from "lucide-react";

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

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({ value, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Determine virtual key code and friendly label
      let code = e.keyCode;
      let name = e.key;

      if (e.code === "AltRight") {
        code = 0xa5; // VK_RMENU
        name = "Right Alt";
      } else if (e.code === "ControlRight") {
        code = 0xa3; // VK_RCONTROL
        name = "Right Ctrl";
      } else if (e.code === "ShiftRight") {
        code = 0xa1; // VK_RSHIFT
        name = "Right Shift";
      } else if (e.code === "Space") {
        name = "Space";
      }

      onChange({
        code,
        name,
        ctrl: e.ctrlKey && e.code !== "ControlLeft" && e.code !== "ControlRight",
        alt: e.altKey && e.code !== "AltLeft" && e.code !== "AltRight",
        shift: e.shiftKey && e.code !== "ShiftLeft" && e.code !== "ShiftRight",
        win: e.metaKey,
      });

      setIsRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, onChange]);

  const displayString = [
    value.ctrl ? "Ctrl" : "",
    value.alt ? "Alt" : "",
    value.shift ? "Shift" : "",
    value.win ? "Win" : "",
    value.name,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setIsRecording(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${
          isRecording
            ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse"
            : "bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:bg-zinc-700/80 hover:border-zinc-600"
        }`}
      >
        <Key className="w-3.5 h-3.5 text-zinc-400" />
        <span>{isRecording ? "Nhấn phím bất kỳ..." : displayString || "Chưa gán phím"}</span>
      </button>

      {isRecording && (
        <button
          type="button"
          onClick={() => setIsRecording(false)}
          className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
        >
          Hủy
        </button>
      )}
    </div>
  );
};

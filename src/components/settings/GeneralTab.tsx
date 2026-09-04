import React from "react";
import { HotkeyRecorder, KeyBinding } from "./HotkeyRecorder";
import { Mic, Radio, Rocket, Monitor } from "lucide-react";

interface GeneralTabProps {
  hotkeyMode: "push_to_talk" | "toggle";
  setHotkeyMode: (mode: "push_to_talk" | "toggle") => void;
  hotkeyBinding: KeyBinding;
  setHotkeyBinding: (binding: KeyBinding) => void;
  autostart: boolean;
  setAutostart: (val: boolean) => void;
  startMinimized: boolean;
  setStartMinimized: (val: boolean) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  hotkeyMode,
  setHotkeyMode,
  hotkeyBinding,
  setHotkeyBinding,
  autostart,
  setAutostart,
  startMinimized,
  setStartMinimized,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">Chế độ phím tắt (Hotkey Mode)</h3>
        <p className="text-xs text-zinc-400 mb-3">
          Chọn cách bạn kích hoạt ghi âm giọng nói khi làm việc trong bất kỳ ứng dụng nào.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setHotkeyMode("push_to_talk")}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              hotkeyMode === "push_to_talk"
                ? "bg-zinc-900 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <Mic className={`w-4 h-4 ${hotkeyMode === "push_to_talk" ? "text-emerald-400" : "text-zinc-400"}`} />
              <span className="text-xs font-semibold text-zinc-200">Push-to-Talk (Giữ để nói)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Nhấn giữ phím tắt để ghi âm. Khi thả phím, hệ thống tự động xử lý và dán kết quả tại con trỏ.
            </p>
          </div>

          <div
            onClick={() => setHotkeyMode("toggle")}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              hotkeyMode === "toggle"
                ? "bg-zinc-900 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <Radio className={`w-4 h-4 ${hotkeyMode === "toggle" ? "text-emerald-400" : "text-zinc-400"}`} />
              <span className="text-xs font-semibold text-zinc-200">Toggle-to-Talk (Bật / Tắt)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Nhấn 1 lần để bắt đầu ghi âm. Nhấn lại lần nữa để kết thúc và tự động dán kết quả.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-zinc-200">Phím tắt toàn hệ thống (Global Hotkey)</div>
            <div className="text-[11px] text-zinc-400">Mặc định: Phím Right Alt (phù hợp người dùng gõ Telex/VNI)</div>
          </div>
          <HotkeyRecorder value={hotkeyBinding} onChange={setHotkeyBinding} />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
        <h4 className="text-xs font-semibold text-zinc-200 mb-2">Hành vi khởi động (Startup Behavior)</h4>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Rocket className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-xs text-zinc-200">Khởi động cùng Windows</div>
              <div className="text-[11px] text-zinc-500">Tự động chạy daemon khi mở máy tính</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={autostart}
            onChange={(e) => setAutostart(e.target.checked)}
            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-xs text-zinc-200">Khởi động ẩn xuống khay hệ thống</div>
              <div className="text-[11px] text-zinc-500">Không mở cửa sổ cài đặt lúc khởi động</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={startMinimized}
            onChange={(e) => setStartMinimized(e.target.checked)}
            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

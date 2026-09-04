import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Info, Activity } from "lucide-react";

interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
}

interface AudioTabProps {
  selectedDevice: string | null;
  setSelectedDevice: (device: string | null) => void;
  vadTimeout: number;
  setVadTimeout: (ms: number) => void;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  selectedDevice,
  setSelectedDevice,
  vadTimeout,
  setVadTimeout,
}) => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);

  useEffect(() => {
    // Load audio devices from backend
    invoke<AudioDevice[]>("get_audio_devices")
      .then((devs) => {
        setDevices(devs);
        if (!selectedDevice && devs.length > 0) {
          const defaultDev = devs.find((d) => d.is_default) || devs[0];
          setSelectedDevice(defaultDev.name);
        }
      })
      .catch(() => {});

    // Listen to real-time audio levels
    const unlistenAudio = listen<number>("audio-level", (e) => {
      setCurrentLevel(Math.min(1.0, Math.max(0.0, e.payload)));
    });

    return () => {
      unlistenAudio.then((f) => f());
    };
  }, [selectedDevice, setSelectedDevice]);

  const toggleTestMic = async () => {
    if (isTestingMic) {
      await invoke("stop_test_mic").catch(() => {});
      setIsTestingMic(false);
      setCurrentLevel(0);
    } else {
      await invoke("start_test_mic", { deviceName: selectedDevice }).catch(() => {});
      setIsTestingMic(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">Thiết bị thu âm (Microphone)</h3>
        <p className="text-xs text-zinc-400 mb-3">
          Chọn microphone thu giọng nói và kiểm tra mức âm lượng đầu vào theo thời gian thực.
        </p>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">Microphone đầu vào</label>
            <div className="relative">
              <select
                value={selectedDevice || ""}
                onChange={(e) => setSelectedDevice(e.target.value || null)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60 transition-colors"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name} {d.is_default ? "(Mặc định của hệ thống)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Level Meter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Mức âm lượng đầu vào (Input Meter)
              </span>
              <button
                type="button"
                onClick={toggleTestMic}
                className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
                  isTestingMic
                    ? "bg-rose-500/20 border-rose-500 text-rose-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {isTestingMic ? "Dừng thử" : "Thử Mic"}
              </button>
            </div>

            <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5 flex">
              <div
                className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                style={{ width: `${Math.round(currentLevel * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-zinc-200">Khoảng ngắt im lặng (Silence Timeout)</span>
            <span className="text-xs font-mono text-emerald-400">{vadTimeout} ms</span>
          </div>
          <p className="text-[11px] text-zinc-400 mb-3">
            Thời gian yên lặng liên tục để hệ thống nhận biết bạn đã nói xong ở chế độ Toggle.
          </p>
          <input
            type="range"
            min="300"
            max="2000"
            step="50"
            value={vadTimeout}
            onChange={(e) => setVadTimeout(Number(e.target.value))}
            className="w-full accent-emerald-500 bg-zinc-950 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
            <span>Nhanh (300ms)</span>
            <span>Cân bằng (700ms)</span>
            <span>Chậm (2000ms)</span>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-zinc-800/80 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-zinc-400 leading-relaxed">
          Định dạng âm thanh: <strong className="text-zinc-200">16,000 Hz Mono S16LE PCM WAV</strong>. Âm thanh được chuyển đổi tự động bằng thuật toán sinc nội suy đa luồng mà không làm trễ thao tác gõ của bạn.
        </div>
      </div>
    </div>
  );
};

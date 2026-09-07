import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Info, Activity, Mic, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { translateIpcError } from "@/lib/ipcErrorMapper";
import { useI18n } from "@/lib/i18n";

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
  onVadTimeoutCommit?: (ms: number) => void;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  selectedDevice,
  setSelectedDevice,
  vadTimeout,
  setVadTimeout,
  onVadTimeoutCommit,
}) => {
  const { t } = useI18n();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);

  const selectedDeviceRef = useRef(selectedDevice);
  selectedDeviceRef.current = selectedDevice;

  const setSelectedDeviceRef = useRef(setSelectedDevice);
  setSelectedDeviceRef.current = setSelectedDevice;

  useEffect(() => {
    // Load audio devices from backend
    invoke<AudioDevice[]>("get_audio_devices")
      .then((devs) => {
        setDevices(devs);
        if (!selectedDeviceRef.current && devs.length > 0) {
          const defaultDev = devs.find((d) => d.is_default) || devs[0];
          setSelectedDeviceRef.current(defaultDev.name);
        }
      })
      .catch((err: unknown) => {
        console.error("Lỗi lấy danh sách thiết bị âm thanh:", err);
      });
  }, []);

  // Listen to real-time audio levels and clean up mic test on unmount
  useEffect(() => {
    const unlistenAudio = listen<number>("audio-level", (e) => {
      setCurrentLevel(Math.min(1.0, Math.max(0.0, e.payload)));
    });

    return () => {
      unlistenAudio.then((f) => f());
      invoke("stop_test_mic").catch(() => {});
    };
  }, []);

  const handleDeviceChange = async (value: string | null) => {
    if (isTestingMic) {
      await invoke("stop_test_mic").catch(() => {});
      setIsTestingMic(false);
      setCurrentLevel(0);
    }
    setSelectedDevice(value);
  };

  const toggleTestMic = async () => {
    setMicError(null);
    if (isTestingMic) {
      try {
        await invoke("stop_test_mic");
      } catch (err: unknown) {
        console.error("Lỗi khi dừng test mic:", err);
      } finally {
        setIsTestingMic(false);
        setCurrentLevel(0);
      }
    } else {
      try {
        setIsTestingMic(true);
        await invoke("start_test_mic", {
          deviceName: selectedDevice || undefined,
        });
      } catch (err: unknown) {
        console.error("Lỗi khi bắt đầu test mic:", err);
        setMicError(translateIpcError(err, t));
        setIsTestingMic(false);
        setCurrentLevel(0);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">
          {t("audio.input_device_title")}
        </h3>
        <p className="text-xs text-zinc-400 mb-3">
          {t("audio.input_device_desc")}
        </p>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              {t("audio.input_device_title")}
            </label>
            <Select
              value={selectedDevice || ""}
              onValueChange={(value) => handleDeviceChange(value || null)}
            >
              <SelectTrigger className="w-full bg-zinc-950/80 border-zinc-800 text-xs text-zinc-200 h-9 rounded-lg focus:ring-emerald-500/50">
                <SelectValue placeholder={t("audio.input_device_title")} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950/95 backdrop-blur-xl border-zinc-800 text-zinc-200 w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)]">
                {devices.length === 0 ? (
                  <div className="p-2 text-xs text-zinc-500 text-center">
                    {t("errors.device_not_found", { device: "" })}
                  </div>
                ) : (
                  devices.map((d) => (
                    <SelectItem
                      key={d.id}
                      value={d.name}
                      className="text-xs focus:bg-zinc-900 focus:text-zinc-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mic className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{d.name}</span>
                        {d.is_default && (
                          <span className="text-[10px] text-emerald-400 font-medium ml-1.5 shrink-0">
                            ({t("common.default")})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Live Level Meter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                {t("audio.level_label")}
              </span>
              <button
                type="button"
                onClick={toggleTestMic}
                className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors ${
                  isTestingMic
                    ? "bg-rose-500/20 border-rose-500/60 text-rose-300 hover:bg-rose-500/30"
                    : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {isTestingMic ? t("audio.stop_test") : t("audio.start_test")}
              </button>
            </div>

            <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5 flex">
              <div
                className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                style={{ width: `${Math.round(currentLevel * 100)}%` }}
              />
            </div>

            {micError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{micError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-zinc-200">
              {t("audio.vad_timeout_label")}
            </span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              {vadTimeout} ms
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mb-3">
            {t("audio.vad_desc")}
          </p>
          <div className="py-2">
            <Slider
              value={[vadTimeout]}
              min={300}
              max={2000}
              step={50}
              onValueChange={([val]) => setVadTimeout(val)}
              onValueCommit={([val]) =>
                onVadTimeoutCommit
                  ? onVadTimeoutCommit(val)
                  : setVadTimeout(val)
              }
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
            <span>300ms</span>
            <span>700ms</span>
            <span>2000ms</span>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-zinc-800/80 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-zinc-400 leading-relaxed">
          <strong className="text-zinc-200">
            16,000 Hz Mono S16LE PCM WAV
          </strong>
        </div>
      </div>
    </div>
  );
};

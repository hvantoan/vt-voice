import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useI18n, LocaleOption } from "@/lib/i18n";

export type OverlayStatus = "idle" | "listening" | "processing" | "pasted" | "error";

interface OverlayPayload {
  status: OverlayStatus;
  message?: string;
}

export const OverlayPill: React.FC = () => {
  const { t, setLocale } = useI18n();
  const [status, setStatus] = useState<OverlayStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);

  useEffect(() => {
    invoke<{ locale?: string }>("get_app_config")
      .then((cfg) => {
        if (cfg?.locale) {
          setLocale(cfg.locale as LocaleOption);
        }
      })
      .catch(() => {});
  }, [setLocale]);

  useEffect(() => {
    // Listen for state transitions from Rust daemon
    const unlistenState = listen<OverlayPayload>("overlay-state", (event) => {
      setStatus(event.payload.status);
      if (event.payload.message) {
        setErrorMessage(event.payload.message);
      }
    });

    // Listen for real-time RMS audio levels
    const unlistenAudio = listen<number>("audio-level", (event) => {
      setAudioLevel(Math.min(1.0, Math.max(0.0, event.payload)));
    });

    return () => {
      unlistenState.then((f) => f());
      unlistenAudio.then((f) => f());
    };
  }, []);

  if (status === "idle") {
    return null;
  }

  // Calculate dynamic heights for 5 audio waveform bars
  const calculateBarHeight = (barIndex: number): number => {
    // Stagger multipliers across the 5 bars for natural speech visualization
    const weights = [0.7, 1.0, 1.3, 0.9, 0.6];
    const baseHeight = 4;
    const maxHeight = 22;
    const dynamic = audioLevel * (maxHeight - baseHeight) * weights[barIndex];
    return Math.min(maxHeight, Math.max(baseHeight, Math.round(baseHeight + dynamic)));
  };

  return (
    <div className="flex items-center justify-center w-full h-full p-1 select-none pointer-events-none">
      <div className="flex items-center justify-between min-w-[240px] max-w-[320px] h-11 px-4 py-2 rounded-full win11-pill border border-white/10 bg-zinc-950/85 backdrop-blur-xl shadow-2xl transition-all duration-150">
        {/* Status indicator & Text */}
        <div className="flex items-center gap-2.5">
          {status === "listening" && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
              </span>
              <span className="text-xs font-semibold text-zinc-100 tracking-wide">
                {t("overlay.listening")}
              </span>
            </>
          )}

          {status === "processing" && (
            <>
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="text-xs font-semibold text-amber-300 tracking-wide">
                {t("overlay.processing")}
              </span>
            </>
          )}

          {status === "pasted" && (
            <>
              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span className="text-xs font-semibold text-emerald-300 tracking-wide">
                {t("overlay.pasted")}
              </span>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="text-xs font-medium text-rose-300 truncate max-w-[200px]">
                {errorMessage || t("overlay.error")}
              </span>
            </>
          )}
        </div>

        {/* Dynamic Waveform Visualizer (Active during listening) */}
        {status === "listening" && (
          <div className="flex items-center gap-[3px] ml-4 h-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-gradient-to-t from-rose-500 to-rose-400 transition-all duration-75"
                style={{
                  height: `${calculateBarHeight(i)}px`,
                  opacity: 0.6 + audioLevel * 0.4,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

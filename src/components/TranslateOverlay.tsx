import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AlertCircle, Check, Copy, Loader2, X } from "lucide-react";
import { useI18n, LocaleOption } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";

interface TranslatePayload {
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  isLoading: boolean;
  error?: string | null;
}

interface TranslateResult {
  translatedText: string;
  isLoading: boolean;
}

let copyTimer: number | undefined;

export const TranslateOverlay: React.FC = () => {
  const { t, setLocale } = useI18n();
  const [source, setSource] = useState<string>("");
  const [sourceLang, setSourceLang] = useState<string>("auto");
  const [targetLang, setTargetLang] = useState<string>("vi");
  const [translated, setTranslated] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [latency, setLatency] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

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
    const unlistenPayload = listen<TranslatePayload>("translate:payload", (event) => {
      setSource(event.payload.sourceText);
      setSourceLang(event.payload.sourceLang || "auto");
      setTargetLang(event.payload.targetLang || "vi");
      setTranslated("");
      setLoading(event.payload.isLoading);
      setError(event.payload.error ?? "");
      if (event.payload.isLoading) {
        startTimeRef.current = Date.now();
        setLatency(null);
      }
    });

    const unlistenResult = listen<TranslateResult>("translate:result", (event) => {
      setTranslated(event.payload.translatedText);
      setLoading(false);
      setError("");
      if (startTimeRef.current) {
        setLatency(Date.now() - startTimeRef.current);
      }
    });

    return () => {
      unlistenPayload.then((fn) => fn());
      unlistenResult.then((fn) => fn());
    };
  }, []);

  const handleCopy = () => {
    void invoke("copy_translation");
    setCopied(true);
    clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => setCopied(false), 1500);
  };

  if (!source && !translated && !error && !loading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center w-full h-full p-2 select-none">
      <div className="win11-acrylic rounded-lg border border-white/10 shadow-xl overflow-hidden p-3 w-full h-full flex flex-col justify-between select-none">
        {/* Header & Telemetry */}
        <div className="flex items-center justify-between gap-2 shrink-0 pb-1.5 border-b border-white/5">
          <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-400">
            <span className="uppercase tracking-wider">
              {sourceLang} → {targetLang}
            </span>
            {latency !== null && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                  {latency}ms
                </span>
              </>
            )}
          </div>
          <button
            onClick={() => void invoke("hide_translate_overlay")}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/10 active:scale-95 transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-col flex-1 min-h-0 py-1 gap-1">
          {source && (
            <div className="text-xs text-zinc-400 font-normal truncate select-text shrink-0">
              {source}
            </div>
          )}

          {loading && (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-zinc-400 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-processing shrink-0" />
              <span className="font-normal leading-normal text-zinc-300">
                {t("overlay.processing")}
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-recording px-2 py-1">
              <AlertCircle className="w-3.5 h-3.5 text-recording shrink-0" />
              <span className="truncate font-normal leading-normal">
                {translateIpcError(error, t)}
              </span>
            </div>
          )}

          {!loading && !error && translated && (
            <div className="flex-1 overflow-y-auto text-sm text-zinc-100 font-normal leading-relaxed select-text pr-1">
              {translated}
            </div>
          )}
        </div>

        {/* Footer with Copy Button */}
        <div className="flex items-center justify-end gap-1.5 pt-1 shrink-0 border-t border-white/5">
          <button
            onClick={handleCopy}
            disabled={!translated || loading}
            aria-label={t("common.copy")}
            title={t("common.copy")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-300 hover:text-zinc-100 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-primary font-medium text-xs leading-normal">
                  {t("common.copied")}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-300 font-normal leading-normal">
                  {t("common.copy")}
                </span>
              </>
            )}
          </button>
      </div>
    </div>
    </div>
  );
};

export default TranslateOverlay;

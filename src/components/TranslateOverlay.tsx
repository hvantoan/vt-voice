import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  Languages,
  Loader2,
  X,
} from "lucide-react";
import { useI18n, LocaleOption } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";
import { cn } from "@/lib/utils";

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
  detectedLang?: string | null;
  targetLang?: string | null;
}

const TARGET_LANGS = [
  { code: "vi", labelKey: "translate.lang_vi", short: "VI" },
  { code: "en", labelKey: "translate.lang_en", short: "EN" },
  { code: "ja", labelKey: "translate.lang_ja", short: "JA" },
  { code: "zh", labelKey: "translate.lang_zh", short: "ZH" },
  { code: "ko", labelKey: "translate.lang_ko", short: "KO" },
] as const;

const LANG_NAME_MAP: Record<string, string> = {
  vi: "translate.lang_vi",
  en: "translate.lang_en",
  ja: "translate.lang_ja",
  zh: "translate.lang_zh",
  "zh-cn": "translate.lang_zh",
  "zh-tw": "translate.lang_zh",
  ko: "translate.lang_ko",
};

let copyTimer: number | undefined;

export const TranslateOverlay: React.FC = () => {
  const { t, setLocale } = useI18n();
  const [source, setSource] = useState<string>("");
  const [sourceLang, setSourceLang] = useState<string>("auto");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
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
      setDetectedLang(null);
      setLoading(event.payload.isLoading);
      setError(event.payload.error ?? "");
      if (event.payload.isLoading) {
        startTimeRef.current = Date.now();
        setLatency(null);
      }
    });

    const unlistenResult = listen<TranslateResult>("translate:result", (event) => {
      setTranslated(event.payload.translatedText);
      if (event.payload.detectedLang) {
        setDetectedLang(event.payload.detectedLang);
      }
      if (event.payload.targetLang) {
        setTargetLang(event.payload.targetLang);
      }
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

  const handleSelectTargetLang = async (newTarget: string) => {
    if (newTarget === targetLang && translated) return;
    setTargetLang(newTarget);
    if (!source) return;
    setLoading(true);
    setError("");
    const start = Date.now();
    try {
      const res = await invoke<TranslateResult>("translate_text", {
        text: source,
        sourceLang: detectedLang || (sourceLang !== "auto" ? sourceLang : "auto"),
        targetLang: newTarget,
      });
      setTranslated(res.translatedText);
      if (res.detectedLang) {
        setDetectedLang(res.detectedLang);
      }
      setLatency(Date.now() - start);
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!source && !translated) return;
    const currentSource = source;
    const currentTranslated = translated;
    const oldTarget = targetLang;
    const oldSource = detectedLang || (sourceLang !== "auto" ? sourceLang : "en");

    const newSource = currentTranslated || currentSource;
    const newTarget = oldSource === oldTarget ? (oldTarget === "vi" ? "en" : "vi") : oldSource;

    setSource(newSource);
    setTargetLang(newTarget);
    setDetectedLang(oldTarget);
    setSourceLang(oldTarget);
    setLoading(true);
    setError("");
    const start = Date.now();
    try {
      const res = await invoke<TranslateResult>("translate_text", {
        text: newSource,
        sourceLang: oldTarget,
        targetLang: newTarget,
      });
      setTranslated(res.translatedText);
      if (res.detectedLang) {
        setDetectedLang(res.detectedLang);
      }
      setLatency(Date.now() - start);
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!source && !translated && !error && !loading) {
    return null;
  }

  const detectedKey = detectedLang ? LANG_NAME_MAP[detectedLang.toLowerCase()] : null;
  const detectedDisplay = detectedKey
    ? t(detectedKey)
    : (detectedLang ? detectedLang.toUpperCase() : t("translate.auto_detect"));

  return (
    <div className="w-full h-full p-0 m-0 select-none overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col justify-between border border-zinc-800 shadow-2xl">
      {/* 1. Header: Language Switcher, Telemetry, Close */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800/80 shrink-0">
        {/* Source info & detected badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Languages className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-medium text-zinc-300 truncate">
            {detectedDisplay}
          </span>
          {/* Swap button */}
          <button
            onClick={() => void handleSwap()}
            disabled={loading || (!source && !translated)}
            aria-label={t("translate.swap_languages")}
            title={t("translate.swap_languages")}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-30 shrink-0"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </button>
        </div>

        {/* Target language selector pills */}
        <div className="flex items-center gap-1 shrink-0 bg-zinc-950/80 p-0.5 rounded border border-zinc-800">
          {TARGET_LANGS.map((lang) => {
            const isActive = targetLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => void handleSelectTargetLang(lang.code)}
                disabled={loading}
                title={t(lang.labelKey)}
                className={cn(
                  "px-1.5 py-0.5 text-[11px] font-mono font-medium rounded transition-all",
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                )}
              >
                {lang.short}
              </button>
            );
          })}
        </div>

        {/* Latency badge & Close button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {latency !== null && (
            <span className="font-mono text-[11px] tabular-nums text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800/40 border border-zinc-800">
              {latency}ms
            </span>
          )}
          <button
            onClick={() => void invoke("hide_translate_overlay")}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Body: 2 Textareas (min 3 lines each) */}
      <div className="flex flex-col flex-1 min-h-0 px-3 py-1.5 gap-1.5 overflow-hidden">
        {/* Component 1: Ngôn ngữ detect được */}
        <div className="flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium px-0.5">
            <span>{t("translate.detected_lang")}</span>
            <span className="text-zinc-500 font-mono text-[11px] uppercase">
              {detectedLang || sourceLang}
            </span>
          </div>
          <textarea
            readOnly
            rows={3}
            value={source}
            placeholder={t("translate.source_placeholder")}
            className="w-full min-h-[54px] max-h-[66px] resize-none text-xs text-zinc-300 bg-zinc-900/60 border border-zinc-800/80 rounded-md p-2 leading-relaxed select-text cursor-text focus:outline-none"
          />
        </div>

        {/* Component 2: Ngôn ngữ dịch */}
        <div className="flex flex-col flex-1 min-h-0 gap-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium px-0.5">
            <span className="text-emerald-400">
              {t("translate.target_lang")} ({targetLang.toUpperCase()})
            </span>
            {loading && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {t("overlay.processing")}
              </span>
            )}
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/50 rounded-md p-2 min-h-[54px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{translateIpcError(error, t)}</span>
            </div>
          ) : (
            <textarea
              readOnly
              rows={3}
              value={translated}
              placeholder={
                loading
                  ? t("overlay.processing")
                  : t("translate.target_placeholder")
              }
              className="w-full flex-1 min-h-[54px] resize-none text-xs text-zinc-100 font-medium bg-zinc-900/90 border border-zinc-700/80 rounded-md p-2 leading-relaxed select-text cursor-text focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* 3. Footer / Actions */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900/60 border-t border-zinc-800/80 shrink-0">
        <span className="text-[11px] text-zinc-400 font-mono tracking-wide">
          {t("translate.shortcut_hint")}
        </span>

        <button
          onClick={handleCopy}
          disabled={!translated || loading}
          aria-label={t("common.copy")}
          title={t("common.copy")}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/60 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-400 text-xs">
                {t("common.copied")}
              </span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-xs text-zinc-300">
                {t("common.copy")}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TranslateOverlay;

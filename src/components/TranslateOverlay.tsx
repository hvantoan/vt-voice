import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AlertCircle, Check, Copy, Loader2, X } from "lucide-react";

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
  const [source, setSource] = useState<string>("");
  const [translated, setTranslated] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const unlistenPayload = listen<TranslatePayload>("translate:payload", (event) => {
      setSource(event.payload.sourceText);
      setTranslated("");
      setLoading(event.payload.isLoading);
      setError(event.payload.error ?? "");
    });

    const unlistenResult = listen<TranslateResult>("translate:result", (event) => {
      setTranslated(event.payload.translatedText);
      setLoading(false);
      setError("");
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

  if (!source && !translated && !error) {
    return null;
  }

  return (
    <div className="flex items-center justify-center w-full h-full p-2 select-none">
      <div className="win11-pill rounded-lg w-full h-full flex flex-col">
        {loading && (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang dịch…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-red-400 px-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {!loading && !error && translated && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="text-xs text-gray-400 truncate px-3 pt-2">{source}</div>
            <div className="flex-1 overflow-y-auto px-3 py-1 text-sm text-gray-100">{translated}</div>
          </div>
        )}

        <div className="flex items-center justify-end px-2 py-1 shrink-0">
          <button
            onClick={() => void invoke("hide_translate_overlay")}
            aria-label="Close"
            className="p-1.5 rounded hover:bg-white/10 text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            disabled={!translated || loading}
            aria-label="Copy translation"
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 text-gray-200"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranslateOverlay;

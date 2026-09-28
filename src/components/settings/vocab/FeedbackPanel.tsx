import React, { useState } from "react";
import {
  Check,
  Copy,
  Award,
  Sparkles,
  BookOpen,
  X,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { StudyFeedbackResult, decodeFeedbackPayload } from "./types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface FeedbackPanelProps {
  feedback: StudyFeedbackResult;
  onClose?: () => void;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  feedback,
  onClose,
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      clearTimeout(copyTimerRef.current as number);
    };
  }, []);

  const decoded = decodeFeedbackPayload(feedback);
  const score = decoded.grammarScore;
  const strengths = decoded.strengths;
  const weaknesses = decoded.weaknesses;
  const suggestions = decoded.suggestions;
  const improvedVersion = decoded.improvedVersion;
  const notedWords = decoded.notedWordsExplanation;
  const rawText = decoded.rawText;
  const isLegacy = decoded.isLegacy;

  const handleCopyImproved = async () => {
    const textToCopy = improvedVersion || "";
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      clearTimeout(copyTimerRef.current as number);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback if clipboard fails
    }
  };
  return (
    <div className="flex flex-col gap-3 p-3.5 bg-zinc-950/70 border border-zinc-800/90 rounded-xl animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
            {t("vocab.feedback_title")}
          </h4>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 1. Điểm số & Nhận xét đánh giá */}
      <div className="flex items-start gap-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
        <div
          className={cn(
            "flex flex-col items-center justify-center shrink-0 w-14 h-14 rounded-lg border font-mono shadow-sm",
            score >= 80
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
              : score >= 60
              ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
              : "bg-rose-500/15 border-rose-500/40 text-rose-400"
          )}
          title={`${t("vocab.score_label")}: ${score}/100`}
        >
          <span className="text-lg font-bold tabular-nums leading-tight">{score}</span>
          <span className="text-[10px] text-zinc-400 font-sans tracking-tight">/100</span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 pb-0.5">
            <span className="text-xs font-medium text-zinc-300">
              {t("vocab.score_label")}
            </span>
            <span
              className={cn(
                "text-xs font-semibold font-mono",
                score >= 80
                  ? "text-emerald-400"
                  : score >= 60
                  ? "text-amber-400"
                  : "text-rose-400"
              )}
            >
              {score}/100
            </span>
          </div>
          {/* 1.1. Cấu trúc mới: 3 khối Green / Red / Amber */}
          {!isLegacy ? (
            <div className="flex flex-col gap-2">
              {/* Khối Green: Điểm làm tốt */}
              {strengths.length > 0 && (
                <div className="flex flex-col gap-1 p-2 rounded-md bg-emerald-950/25 border border-emerald-900/40">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    {t("vocab.strengths_title")}
                  </span>
                  <ul className="flex flex-col gap-1 pl-5 list-disc text-xs text-emerald-200/90 leading-relaxed">
                    {strengths.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Khối Red: Cần cải thiện */}
              {weaknesses.length > 0 ? (
                <div className="flex flex-col gap-1 p-2 rounded-md bg-rose-950/25 border border-rose-900/40">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {t("vocab.weaknesses_title")}
                  </span>
                  <ul className="flex flex-col gap-1 pl-5 list-disc text-xs text-rose-200/90 leading-relaxed">
                    {weaknesses.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : strengths.length > 0 ? (
                <div className="flex items-center gap-2 p-1.5 rounded-md bg-emerald-950/15 border border-emerald-900/30 text-[11px] text-emerald-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{t("vocab.no_weaknesses")}</span>
                </div>
              ) : null}

              {/* Khối Amber: Đề xuất diễn đạt hay hơn */}
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-1 p-2 rounded-md bg-amber-950/20 border border-amber-900/30">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                    {t("vocab.suggestions_title")}
                  </span>
                  <ul className="flex flex-col gap-1 pl-5 list-disc text-xs text-amber-200/90 leading-relaxed">
                    {suggestions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Fallback cho dữ liệu cũ */
            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {rawText}
            </p>
          )}
        </div>
      </div>
      {/* 2. Bản dịch tự nhiên gợi ý */}
      {improvedVersion && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
              <Award className="w-3.5 h-3.5" />
              {t("vocab.improved_title")}
            </span>

            <button
              type="button"
              onClick={handleCopyImproved}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">{t("common.copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t("common.copy")}</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs font-medium text-zinc-200 leading-relaxed select-text">
            {improvedVersion}
          </p>
        </div>
      )}

      {/* 3. Giải nghĩa từ vựng đã note */}
      {notedWords.length > 0 && (
        <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-sky-400">
            <BookOpen className="w-3.5 h-3.5" />
            {t("vocab.noted_words_title")}
          </span>

          <div className="flex flex-col gap-1.5 divide-y divide-zinc-800/70">
            {notedWords.map((item, idx) => {
              const word = item.wordOrPhrase || (item as unknown as { word_or_phrase?: string }).word_or_phrase || "";
              const translation = item.translation || "";
              const explanation = item.explanation || "";

              return (
                <div key={idx} className={cn("flex flex-col gap-0.5", idx > 0 && "pt-1.5")}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-emerald-300 font-mono">
                      {word}
                    </span>
                    <span className="text-xs text-zinc-200 font-medium">
                      : {translation}
                    </span>
                  </div>
                  {explanation && (
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

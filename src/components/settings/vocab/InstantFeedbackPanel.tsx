import React, { useState, useRef, useEffect } from "react";
import {
  Check,
  Copy,
  Sparkles,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  DiffToken,
  LocalEvaluationResult,
  StudyFeedbackResult,
  TargetVocabItem,
} from "./types";
import { FeedbackPanel } from "./FeedbackPanel";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface InstantFeedbackPanelProps {
  result: LocalEvaluationResult;
  onCopyCanonical: () => void;
  onAskAiDeep: () => void;
  isAiLoading?: boolean;
  onReplaceWord?: (token: DiffToken) => void;
  deepAiFeedback?: StudyFeedbackResult | null;
  onCloseDeepFeedback?: () => void;
}

export const InstantFeedbackPanel: React.FC<InstantFeedbackPanelProps> = ({
  result,
  onCopyCanonical,
  onAskAiDeep,
  isAiLoading = false,
  onReplaceWord,
  deepAiFeedback,
  onCloseDeepFeedback,
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      clearTimeout(copyTimerRef.current as number);
    };
  }, []);

  const handleCopy = () => {
    onCopyCanonical();
    setCopied(true);
    clearTimeout(copyTimerRef.current as number);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const { score, hasTypo, diffTokens, bestReference, matchedAlternative, grammarFocus, commonMistakes, targetVocab } = result;

  // Quyết định màu sắc và nhãn của điểm số
  let scoreBadgeClass = "bg-rose-950/60 border-rose-500/40 text-rose-300";
  let scoreLabel = t("vocab.score_needs_review");
  let scoreIcon = <AlertCircle className="w-3.5 h-3.5 mr-1" />;

  if (score >= 95) {
    scoreBadgeClass = "bg-emerald-950/60 border-emerald-500/40 text-emerald-300";
    scoreLabel = t("vocab.score_perfect");
    scoreIcon = <CheckCircle2 className="w-3.5 h-3.5 mr-1" />;
  } else if (score >= 85) {
    scoreBadgeClass = "bg-teal-950/60 border-teal-500/40 text-teal-300";
    scoreLabel = hasTypo
      ? t("vocab.score_typo")
      : t("vocab.score_good");
    scoreIcon = <Check className="w-3.5 h-3.5 mr-1" />;
  } else if (score >= 65) {
    scoreBadgeClass = "bg-amber-950/60 border-amber-500/40 text-amber-300";
    scoreLabel = t("vocab.score_good");
    scoreIcon = <HelpCircle className="w-3.5 h-3.5 mr-1" />;
  }

  return (
    <div className="flex flex-col gap-3 p-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-xl animate-in fade-in-50 duration-150">
      {/* 1. Header: Điểm số & Nút hành động */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs px-2.5 py-1 font-semibold flex items-center border ${scoreBadgeClass}`}
          >
            {scoreIcon}
            <span>
              {score}/100 — {scoreLabel}
            </span>
          </Badge>

          {matchedAlternative && (
            <span className="text-[11px] text-teal-400/90 font-medium italic truncate max-w-[280px]">
              {t("vocab.matched_alternative")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            title={t("vocab.copy_canonical")}
            className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAskAiDeep}
            disabled={isAiLoading}
            className="h-7 px-2.5 text-[11px] bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200 hover:text-white cursor-pointer transition-all"
          >
            {isAiLoading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin text-amber-400" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
            )}
            <span>{t("vocab.ask_ai_deep")}</span>
          </Button>
        </div>
      </div>

      {/* 2. Visual Token Diff Container */}
      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
        <div className="text-[11px] text-zinc-400 font-medium mb-0.5 flex items-center justify-between">
          <span>{t("vocab.your_translation")}</span>
          {onReplaceWord && (
            <span className="text-[10px] text-zinc-500 italic">
              {t("vocab.click_word_to_fix")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 leading-relaxed py-1">
          {diffTokens.map((token, idx) => {
            const key = `token-${idx}-${token.text}`;

            if (token.status === "correct") {
              return (
                <span
                  key={key}
                  className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-xs font-medium"
                >
                  {token.text}
                </span>
              );
            }

            if (token.status === "typo") {
              return (
                <span
                  key={key}
                  onClick={() => onReplaceWord && onReplaceWord(token)}
                  title={`Lỗi gõ: nên là "${token.expected}". Click để sửa`}
                  className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/40 text-xs font-medium underline decoration-wavy decoration-amber-400 cursor-pointer hover:bg-amber-900/50 transition-colors"
                >
                  {token.text}
                  {token.expected && (
                    <span className="ml-1 text-[10px] text-emerald-400 no-underline font-normal">
                      → {token.expected}
                    </span>
                  )}
                </span>
              );
            }

            if (token.status === "replaced") {
              return (
                <span
                  key={key}
                  onClick={() => onReplaceWord && onReplaceWord(token)}
                  title={`Sai từ: nên dùng "${token.expected}". Click để sửa`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-500/40 text-xs font-medium cursor-pointer hover:bg-rose-900/50 transition-colors"
                >
                  <span className="line-through opacity-80">{token.text}</span>
                  {token.expected && (
                    <span className="text-emerald-300 font-semibold no-underline">
                      [{token.expected}]
                    </span>
                  )}
                </span>
              );
            }

            if (token.status === "extraneous") {
              return (
                <span
                  key={key}
                  title="Từ thừa không có trong câu chuẩn"
                  className="px-2 py-0.5 rounded bg-rose-950/30 text-rose-400 border border-rose-500/30 text-xs font-medium line-through opacity-75"
                >
                  {token.text}
                </span>
              );
            }

            if (token.status === "missing") {
              return (
                <span
                  key={key}
                  onClick={() => onReplaceWord && onReplaceWord(token)}
                  title={`Thiếu từ: "${token.expected}". Click để chèn`}
                  className="px-2 py-0.5 rounded border border-dashed border-amber-500/60 bg-amber-950/30 text-amber-300 text-xs font-medium cursor-pointer hover:bg-amber-900/50 transition-colors"
                >
                  + {token.expected}
                </span>
              );
            }

            return null;
          })}
        </div>

        {/* Đáp án chuẩn */}
        <div className="mt-2 pt-2 border-t border-zinc-800/60 flex flex-col gap-1">
          <span className="text-[11px] text-zinc-400 font-medium">
            {t("vocab.canonical_translation")}
          </span>
          <p className="text-xs text-zinc-200 font-medium select-text py-0.5">
            {bestReference}
          </p>
        </div>
      </div>

      {/* 3. Từ vựng trọng tâm (Target Vocab) */}
      {targetVocab && targetVocab.length > 0 && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t("vocab.target_vocab_title")}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {targetVocab.map((v: TargetVocabItem, idx: number) => (
              <div
                key={`vocab-${idx}-${v.word}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/70 border border-zinc-700/60 text-xs text-zinc-200 font-medium"
              >
                <span className="text-indigo-300 font-semibold">{v.word}</span>
                {(v.wordType || v.type) && (
                  <span className="text-[10px] text-zinc-400 font-mono italic">
                    ({v.wordType || v.type})
                  </span>
                )}
                <span className="text-zinc-300">: {v.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Trọng tâm ngữ pháp & Bẫy lỗi thường gặp */}
      {(grammarFocus || (commonMistakes && commonMistakes.length > 0)) && (
        <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-xs">
          {grammarFocus && (
            <div className="flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider">
                  {t("vocab.grammar_focus_title")}
                </span>
                <p className="text-zinc-300 text-xs py-0.5 leading-relaxed">{grammarFocus}</p>
              </div>
            </div>
          )}

          {commonMistakes && commonMistakes.length > 0 && (
            <div className="flex items-start gap-2 pt-1 border-t border-zinc-800/40">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-rose-300/90 uppercase tracking-wider">
                  {t("vocab.common_mistakes_title")}
                </span>
                <ul className="list-disc list-inside text-zinc-300 text-xs py-0.5 space-y-0.5">
                  {commonMistakes.map((m, idx) => (
                    <li key={`mistake-${idx}`}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Hướng dẫn phím tắt */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-1">
        <span>
          {score >= 85
            ? t("vocab.shortcut_instant_next")
            : t("vocab.shortcut_instant_retry")}
        </span>
      </div>

      {/* 6. Phân tích AI chuyên sâu nếu người dùng đã yêu cầu */}
      {deepAiFeedback && (
        <div className="mt-2 pt-2 border-t border-zinc-800/80">
          <FeedbackPanel feedback={deepAiFeedback} onClose={onCloseDeepFeedback} />
        </div>
      )}
    </div>
  );
};

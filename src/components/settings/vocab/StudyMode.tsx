import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Send,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import {
  StudySentence,
  StudyFeedbackResult,
  StudyAttempt,
  decodeFeedbackPayload,
  DiffToken,
  LocalEvaluationResult,
} from "./types";
import { FeedbackPanel } from "./FeedbackPanel";
import { TokenizedSentence } from "./TokenizedSentence";
import { InstantFeedbackPanel } from "./InstantFeedbackPanel";
import { evaluateLocalAttempt } from "./localEvaluation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";

interface SentenceStateCache {
  userTranslation: string;
  notedWords: string[];
  feedback: StudyFeedbackResult | null;
  lastSubmittedText?: string | null;
  localResult?: LocalEvaluationResult | null;
  deepAiFeedback?: StudyFeedbackResult | null;
}

interface StudyModeProps {
  sentence: StudySentence | null;
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onDeleteSentence: (id: string) => void;
  onAttemptSaved?: () => void;
}

export const StudyMode: React.FC<StudyModeProps> = ({
  sentence,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  onDeleteSentence,
  onAttemptSaved,
}) => {
  const { t } = useI18n();
  const [notedWords, setNotedWords] = useState<string[]>([]);
  const [userTranslation, setUserTranslation] = useState("");
  const [feedback, setFeedback] = useState<StudyFeedbackResult | null>(null);
  const [localResult, setLocalResult] = useState<LocalEvaluationResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [deepAiFeedback, setDeepAiFeedback] = useState<StudyFeedbackResult | null>(null);
  const [lastSubmittedText, setLastSubmittedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cacheRef = useRef<Record<string, SentenceStateCache>>({});

  // Khôi phục kết quả làm bài cũ hoặc thiết lập lại trạng thái khi đổi câu
  useEffect(() => {
    if (!sentence) {
      setNotedWords([]);
      setUserTranslation("");
      setFeedback(null);
      setLastSubmittedText(null);
      setError(null);
      return;
    }

    const sid = sentence.id;
    setError(null);

    // 1. Kiểm tra cache trong bộ nhớ (cùng session làm bài)
    const cached = cacheRef.current[sid];
    if (cached) {
      setUserTranslation(cached.userTranslation);
      setNotedWords(cached.notedWords);
      setFeedback(cached.feedback);
      setLocalResult(cached.localResult ?? null);
      setDeepAiFeedback(cached.deepAiFeedback ?? null);
      setLastSubmittedText(cached.lastSubmittedText ?? (cached.feedback ? cached.userTranslation : null));
      if (!cached.feedback && !cached.localResult) {
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
      return;
    }

    // 2. Nếu chưa có trong cache phiên hiện tại, truy vấn SQLite lấy lượt làm gần nhất
    let isMounted = true;
    invoke<StudyAttempt[]>("get_study_history", { sentenceId: sid, limit: 1 })
      .then((history) => {
        if (!isMounted) return;
        if (history && history.length > 0) {
          const latest = history[0];
          setUserTranslation(latest.userTranslation);
          setNotedWords([]);
          setLastSubmittedText(latest.userTranslation);

          const evalResult = evaluateLocalAttempt(sentence, latest.userTranslation);
          setLocalResult(evalResult);

          const decoded = decodeFeedbackPayload(latest.feedbackText, latest.grammarScore, latest.improvedVersion);
          if (decoded.strengths.length > 0 || decoded.weaknesses.length > 0 || decoded.suggestions.length > 0 || decoded.rawText) {
            const restoredFeedback: StudyFeedbackResult = {
              grammarScore: decoded.grammarScore,
              strengths: decoded.strengths,
              weaknesses: decoded.weaknesses,
              suggestions: decoded.suggestions,
              feedbackText: decoded.rawText,
              improvedVersion: decoded.improvedVersion,
              notedWordsExplanation: decoded.notedWordsExplanation,
            };
            setDeepAiFeedback(restoredFeedback);
          } else {
            setDeepAiFeedback(null);
          }
          setFeedback(null);

          cacheRef.current[sid] = {
            userTranslation: latest.userTranslation,
            notedWords: [],
            feedback: null,
            localResult: evalResult,
            deepAiFeedback: null,
            lastSubmittedText: latest.userTranslation,
          };
        } else {
          setUserTranslation("");
          setNotedWords([]);
          setFeedback(null);
          setLocalResult(null);
          setDeepAiFeedback(null);
          setLastSubmittedText(null);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setUserTranslation("");
        setNotedWords([]);
        setFeedback(null);
        setLocalResult(null);
        setDeepAiFeedback(null);
        setLastSubmittedText(null);
        setTimeout(() => textareaRef.current?.focus(), 50);
      });

    return () => {
      isMounted = false;
    };
  }, [sentence?.id]);

  const updateWordsAndCache = (updater: (prev: string[]) => string[]) => {
    setNotedWords((prev) => {
      const next = updater(prev);
      if (sentence) {
        const existing = cacheRef.current[sentence.id];
        cacheRef.current[sentence.id] = {
          userTranslation: existing?.userTranslation ?? userTranslation,
          notedWords: next,
          feedback: existing?.feedback ?? feedback,
          lastSubmittedText: existing?.lastSubmittedText ?? lastSubmittedText,
        };
      }
      return next;
    });
  };

  const handleTranslationChange = (text: string) => {
    setUserTranslation(text);
    setLocalResult(null);
    if (sentence) {
      const existing = cacheRef.current[sentence.id];
      cacheRef.current[sentence.id] = {
        userTranslation: text,
        notedWords: existing?.notedWords ?? notedWords,
        feedback: existing?.feedback ?? feedback,
        lastSubmittedText: existing?.lastSubmittedText ?? lastSubmittedText,
        localResult: null,
        deepAiFeedback: existing?.deepAiFeedback ?? deepAiFeedback,
      };
    }
  };

  const handleCloseFeedback = () => {
    setFeedback(null);
    setLastSubmittedText(null);
    if (sentence && cacheRef.current[sentence.id]) {
      cacheRef.current[sentence.id].feedback = null;
      cacheRef.current[sentence.id].lastSubmittedText = null;
    }
  };

  const handleToggleWord = (word: string, isCtrl: boolean) => {
    const target = word.trim();
    if (!target) return;

    if (isCtrl) {
      // Multi-select mode
      updateWordsAndCache((prev) => {
        const exists = prev.some((w) => w.toLowerCase() === target.toLowerCase());
        if (exists) {
          return prev.filter((w) => w.toLowerCase() !== target.toLowerCase());
        } else {
          return [...prev, target];
        }
      });
    } else {
      // Single-select mode: if clicked again, unselect; otherwise select only this word
      updateWordsAndCache((prev) => {
        const isSelected = prev.length === 1 && prev[0].toLowerCase() === target.toLowerCase();
        return isSelected ? [] : [target];
      });
    }
  };

  const handleRemoveWord = (word: string) => {
    updateWordsAndCache((prev) => prev.filter((w) => w.toLowerCase() !== word.toLowerCase()));
  };
  const handleLocalEvaluate = () => {
    if (!sentence || !userTranslation.trim()) return;
    const trimmed = userTranslation.trim();
    const result = evaluateLocalAttempt(sentence, trimmed);
    setLocalResult(result);
    setLastSubmittedText(trimmed);

    if (sentence) {
      cacheRef.current[sentence.id] = {
        userTranslation: trimmed,
        notedWords: [...notedWords],
        feedback,
        lastSubmittedText: trimmed,
        localResult: result,
        deepAiFeedback,
      };
    }

    // Lưu lượt làm bài vào SQLite ngầm (non-blocking)
    invoke("save_local_study_attempt", {
      sentenceId: sentence.id,
      userTranslation: trimmed,
      grammarScore: result.score,
      feedbackText: JSON.stringify({
        score: result.score,
        bestReference: result.bestReference,
        diffTokens: result.diffTokens,
      }),
      improvedVersion: result.bestReference,
    })
      .then(() => {
        onAttemptSaved?.();
      })
      .catch((err) => {
        console.error("Failed to save local study attempt:", err);
      });

    // Tự động nhảy con trỏ tới từ sai đầu tiên
    const firstError = result.diffTokens.find(
      (t) => t.status === "typo" || t.status === "replaced" || t.status === "missing"
    );
    if (firstError && firstError.startIndex !== undefined && firstError.endIndex !== undefined) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(firstError.startIndex!, firstError.endIndex!);
        }
      }, 50);
    }
  };

  const handleReplaceWord = (token: DiffToken) => {
    if (!token.expected) return;
    let newText = userTranslation;
    if (token.status === "typo" || token.status === "replaced") {
      if (token.startIndex !== undefined && token.endIndex !== undefined) {
        newText =
          userTranslation.slice(0, token.startIndex) +
          token.expected +
          userTranslation.slice(token.endIndex);
      }
    } else if (token.status === "missing") {
      if (token.startIndex !== undefined) {
        const before = userTranslation.slice(0, token.startIndex).trimEnd();
        const after = userTranslation.slice(token.startIndex).trimStart();
        newText = (before ? before + " " : "") + token.expected + (after ? " " + after : "");
      }
    }
    setUserTranslation(newText);
    if (sentence) {
      const rechecked = evaluateLocalAttempt(sentence, newText);
      setLocalResult(rechecked);
      setLastSubmittedText(newText.trim());
      cacheRef.current[sentence.id] = {
        ...cacheRef.current[sentence.id],
        userTranslation: newText,
        localResult: rechecked,
      };
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleAskAiDeep = async () => {
    if (!sentence || !userTranslation.trim() || isAiLoading) return;
    setIsAiLoading(true);
    setError(null);
    try {
      const trimmedTranslation = userTranslation.trim();
      const res = await invoke<StudyFeedbackResult>("submit_study_attempt", {
        sentenceId: sentence.id,
        sourceText: sentence.sourceText,
        userTranslation: trimmedTranslation,
        sourceLang: sentence.sourceLang || "en",
        targetLang: sentence.targetLang || "vi",
        notedWords,
      });
      setDeepAiFeedback(res);
      if (sentence) {
        cacheRef.current[sentence.id] = {
          ...cacheRef.current[sentence.id],
          deepAiFeedback: res,
        };
      }
      onAttemptSaved?.();
    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : String(err);
      setError(translateIpcError(rawError, t));
    } finally {
      setIsAiLoading(false);
    }
  };



  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalCount - 1;

  const handlePrevSentence = () => {
    if (canGoPrev) {
      onPrev();
    }
  };

  const handleNextSentence = () => {
    if (canGoNext) {
      onNext();
    }
  };

  const hasNoEditsAfterSubmit = Boolean(
    (feedback || localResult) &&
    lastSubmittedText !== null &&
    userTranslation.trim() === lastSubmittedText.trim()
  );

  // Lắng nghe phím tắt toàn cục: ArrowLeft/ArrowRight và Enter khi focus ngoài input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang mở modal/dialog
      if (document.querySelector('[role="dialog"]')) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInsideInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      if (isInsideInput) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevSentence();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextSentence();
      } else if (e.key === "Enter" && !e.shiftKey && hasNoEditsAfterSubmit) {
        if (target instanceof HTMLButtonElement) {
          return;
        }
        e.preventDefault();
        handleNextSentence();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [canGoPrev, canGoNext, hasNoEditsAfterSubmit, onPrev, onNext]);

  if (!sentence) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] p-6 text-center text-zinc-500">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
          <BookOpen className="w-6 h-6 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-1">
          {t("vocab.empty_sentences_title")}
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
          {t("vocab.empty_sentences_desc")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 pb-4">
      {/* 1. Header & Navigation Controls */}
      <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          {sentence.difficultyLevel && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-zinc-800 text-emerald-400 border-emerald-500/30">
              {sentence.difficultyLevel}
            </Badge>
          )}

          {sentence.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-400 bg-zinc-800/80 border-zinc-700">
              {sentence.category}
            </Badge>
          )}

          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-800 font-mono">
            {sentence.origin}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tabular-nums text-zinc-400">
            {currentIndex + 1} / {totalCount}
          </span>

          <div className="flex items-center gap-0.5 border-l border-zinc-800 pl-2">
            <button
              type="button"
              onClick={handlePrevSentence}
              disabled={!canGoPrev}
              aria-label={t("vocab.prev_sentence")}
              title={`${t("vocab.prev_sentence")} (←)`}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleNextSentence}
              disabled={!canGoNext}
              aria-label={t("vocab.next_sentence")}
              title={`${t("vocab.next_sentence")} (→)`}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                delete cacheRef.current[sentence.id];
                onDeleteSentence(sentence.id);
              }}
              aria-label={t("vocab.delete_sentence")}
              title={t("vocab.delete_sentence")}
              className="p-1 rounded hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400 ml-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Câu nguồn có thể click chọn từ */}
      <TokenizedSentence
        text={sentence.sourceText}
        notedWords={notedWords}
        onToggleWord={handleToggleWord}
        onRemoveWord={handleRemoveWord}
        onClearAll={() => updateWordsAndCache(() => [])}
      />

      {/* 3. Ô nhập liệu bài dịch & nút Nộp bài */}
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          rows={3}
          value={userTranslation}
          onChange={(e) => handleTranslationChange(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl+Enter: nộp bài / chấm điểm tức thì
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleLocalEvaluate();
              return;
            }

            // Ctrl+ArrowRight: bỏ qua, chuyển câu tiếp theo
            if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleNextSentence();
              return;
            }

            // Enter bình thường:
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              if (!localResult) {
                handleLocalEvaluate();
              } else if (localResult.score >= 85 || hasNoEditsAfterSubmit) {
                handleNextSentence();
              } else {
                handleLocalEvaluate();
              }
              return;
            }

            // ArrowLeft / ArrowRight trong textarea khi trống hoặc điểm cao
            if (
              !e.ctrlKey &&
              !e.metaKey &&
              !e.altKey &&
              (e.key === "ArrowLeft" || e.key === "ArrowRight")
            ) {
              const isEmpty = userTranslation.trim() === "";
              if (isEmpty || (localResult && localResult.score >= 85)) {
                e.preventDefault();
                if (e.key === "ArrowLeft") {
                  handlePrevSentence();
                } else {
                  handleNextSentence();
                }
              }
            }
          }}
          placeholder={t("vocab.input_placeholder")}
          className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg p-3 resize-none focus:outline-none focus:border-zinc-700 transition-colors leading-relaxed"
        />

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">
            {localResult && localResult.score >= 85
              ? t("vocab.shortcut_instant_next")
              : t("vocab.shortcut_submit")}
          </span>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (localResult && localResult.score >= 85) {
                handleNextSentence();
              } else {
                handleLocalEvaluate();
              }
            }}
            disabled={!userTranslation.trim()}
            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer shadow-sm transition-all"
          >
            {localResult && localResult.score >= 85 ? (
              <>
                <ChevronRight className="w-3.5 h-3.5 mr-1" />
                <span>{t("vocab.next_sentence")}</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>{localResult ? t("vocab.recheck_button") : t("vocab.check_button")}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error notification banner */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Vùng hiển thị kết quả đánh giá */}
      {localResult ? (
        <InstantFeedbackPanel
          result={localResult}
          onCopyCanonical={() => {
            if (localResult.bestReference) {
              navigator.clipboard.writeText(localResult.bestReference);
            }
          }}
          onAskAiDeep={handleAskAiDeep}
          isAiLoading={isAiLoading}
          onReplaceWord={handleReplaceWord}
          deepAiFeedback={deepAiFeedback}
          onCloseDeepFeedback={() => setDeepAiFeedback(null)}
        />
      ) : (
        feedback && (
          <FeedbackPanel feedback={feedback} onClose={handleCloseFeedback} />
        )
      )}
    </div>
  );
};

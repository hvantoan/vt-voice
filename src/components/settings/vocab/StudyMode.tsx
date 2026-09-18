import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Send,
  Loader2,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { StudySentence, StudyFeedbackResult, StudyAttempt, decodeFeedbackPayload } from "./types";
import { FeedbackPanel } from "./FeedbackPanel";
import { TokenizedSentence } from "./TokenizedSentence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";

interface SentenceStateCache {
  userTranslation: string;
  notedWords: string[];
  feedback: StudyFeedbackResult | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<StudyFeedbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cacheRef = useRef<Record<string, SentenceStateCache>>({});

  // Khôi phục kết quả làm bài cũ hoặc thiết lập lại trạng thái khi đổi câu
  useEffect(() => {
    if (!sentence) {
      setNotedWords([]);
      setUserTranslation("");
      setFeedback(null);
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
      if (!cached.feedback) {
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
          const decoded = decodeFeedbackPayload(latest.feedbackText, latest.grammarScore, latest.improvedVersion);
          const restoredFeedback: StudyFeedbackResult = {
            grammarScore: decoded.grammarScore,
            strengths: decoded.strengths,
            weaknesses: decoded.weaknesses,
            suggestions: decoded.suggestions,
            feedbackText: decoded.rawText,
            improvedVersion: decoded.improvedVersion,
            notedWordsExplanation: decoded.notedWordsExplanation,
          };
          setUserTranslation(latest.userTranslation);
          setNotedWords([]);
          setFeedback(restoredFeedback);
          cacheRef.current[sid] = {
            userTranslation: latest.userTranslation,
            notedWords: [],
            feedback: restoredFeedback,
          };
        } else {
          setUserTranslation("");
          setNotedWords([]);
          setFeedback(null);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setUserTranslation("");
        setNotedWords([]);
        setFeedback(null);
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
        };
      }
      return next;
    });
  };

  const handleTranslationChange = (text: string) => {
    setUserTranslation(text);
    if (sentence) {
      const existing = cacheRef.current[sentence.id];
      cacheRef.current[sentence.id] = {
        userTranslation: text,
        notedWords: existing?.notedWords ?? notedWords,
        feedback: existing?.feedback ?? feedback,
      };
    }
  };

  const handleCloseFeedback = () => {
    setFeedback(null);
    if (sentence && cacheRef.current[sentence.id]) {
      cacheRef.current[sentence.id].feedback = null;
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

  const handleSubmit = async () => {
    if (!sentence || !userTranslation.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await invoke<StudyFeedbackResult>("submit_study_attempt", {
        sentenceId: sentence.id,
        sourceText: sentence.sourceText,
        userTranslation: userTranslation.trim(),
        sourceLang: sentence.sourceLang || "en",
        targetLang: sentence.targetLang || "vi",
        notedWords,
      });

      setFeedback(res);
      if (sentence) {
        cacheRef.current[sentence.id] = {
          userTranslation: userTranslation.trim(),
          notedWords: [...notedWords],
          feedback: res,
        };
      }
      if (onAttemptSaved) {
        onAttemptSaved();
      }
    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : String(err);
      setError(translateIpcError(rawError, t));
    } finally {
      setIsSubmitting(false);
    }
  };

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
              onClick={onPrev}
              disabled={currentIndex === 0}
              aria-label={t("vocab.prev_sentence")}
              title={t("vocab.prev_sentence")}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={currentIndex >= totalCount - 1}
              aria-label={t("vocab.next_sentence")}
              title={t("vocab.next_sentence")}
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
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder={t("vocab.input_placeholder")}
          className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg p-3 resize-none focus:outline-none focus:border-zinc-700 transition-colors leading-relaxed"
        />

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">
            {t("vocab.shortcut_submit")}
          </span>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!userTranslation.trim() || isSubmitting}
            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer shadow-sm transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                <span>{t("vocab.submitting")}</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>{t("vocab.submit_button")}</span>
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

      {/* 4. Vùng hiển thị kết quả đánh giá (Feedback) */}
      {feedback && (
        <FeedbackPanel feedback={feedback} onClose={handleCloseFeedback} />
      )}
    </div>
  );
};

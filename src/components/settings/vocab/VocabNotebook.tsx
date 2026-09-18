import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BookMarked,
  History,
  Trash2,
  Calendar,
  Sparkles,
  Quote,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { SavedVocab, StudyAttempt, decodeFeedbackPayload } from "./types";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface VocabNotebookProps {
  onRefreshTrigger?: number;
}

export const VocabNotebook: React.FC<VocabNotebookProps> = ({
  onRefreshTrigger,
}) => {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<"vocab" | "attempts">("vocab");
  const [vocabList, setVocabList] = useState<SavedVocab[]>([]);
  const [historyList, setHistoryList] = useState<StudyAttempt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vocabs, attempts] = await Promise.all([
        invoke<SavedVocab[]>("get_saved_vocab"),
        invoke<StudyAttempt[]>("get_study_history", { limit: 100 }),
      ]);
      setVocabList(vocabs);
      setHistoryList(attempts);
    } catch (err) {
      console.error("Failed to load vocab notebook data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [onRefreshTrigger]);

  const handleDeleteVocab = async (id: string) => {
    try {
      await invoke("delete_saved_vocab", { id });
      setVocabList((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete vocab item:", err);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Sub-tab switcher */}
      <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSubTab("vocab")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
              subTab === "vocab"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <BookMarked className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t("vocab.tab_saved_vocab")}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-zinc-700 bg-zinc-900/80 font-mono">
              {vocabList.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("attempts")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
              subTab === "attempts"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <History className="w-3.5 h-3.5 text-sky-400" />
            <span>{t("vocab.tab_attempts")}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-zinc-700 bg-zinc-900/80 font-mono">
              {historyList.length}
            </Badge>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[240px]">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      ) : subTab === "vocab" ? (
        vocabList.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[220px] text-center text-zinc-500">
            <BookMarked className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-xs">{t("vocab.empty_vocab")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {vocabList.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-emerald-400 font-mono">
                      {item.wordOrPhrase}
                    </span>
                    {item.translation && (
                      <span className="text-xs text-zinc-200 font-medium">
                        : {item.translation}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(item.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteVocab(item.id)}
                      className="text-zinc-500 hover:text-rose-400 cursor-pointer p-0.5 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {item.notes && (
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {item.notes}
                  </p>
                )}

                {item.sourceContext && (
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 italic bg-zinc-950/40 p-1.5 rounded border border-zinc-900">
                    <Quote className="w-3 h-3 text-zinc-600 shrink-0" />
                    <span className="truncate">{item.sourceContext}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : historyList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] text-center text-zinc-500">
          <History className="w-8 h-8 text-zinc-600 mb-2" />
          <p className="text-xs">{t("vocab.empty_history")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {historyList.map((item) => {
            const decoded = decodeFeedbackPayload(item.feedbackText, item.grammarScore, item.improvedVersion);
            const score = decoded.grammarScore;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-1.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border",
                        score >= 80
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : score >= 60
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                          : "bg-rose-500/15 border-rose-500/40 text-rose-400"
                      )}
                    >
                      {score}
                    </span>
                    <span className="text-xs text-zinc-300 font-medium select-text">
                      {item.userTranslation}
                    </span>
                  </div>

                  <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDate(item.createdAt)}
                  </span>
                </div>

                {item.improvedVersion && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-900/40 p-1.5 rounded">
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="select-text">{item.improvedVersion}</span>
                  </div>
                )}

                {!decoded.isLegacy ? (
                  <div className="flex flex-col gap-1.5 mt-1 pt-1.5 border-t border-zinc-800/60">
                    {decoded.strengths.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 font-semibold text-emerald-400 text-[10px]">
                          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          {t("vocab.strengths_title")}
                        </span>
                        <ul className="pl-3.5 list-disc space-y-0.5 text-[11px] text-emerald-200/80 leading-snug">
                          {decoded.strengths.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {decoded.weaknesses.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 font-semibold text-rose-400 text-[10px]">
                          <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                          {t("vocab.weaknesses_title")}
                        </span>
                        <ul className="pl-3.5 list-disc space-y-0.5 text-[11px] text-rose-200/80 leading-snug">
                          {decoded.weaknesses.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {decoded.suggestions.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 font-semibold text-amber-400 text-[10px]">
                          <Lightbulb className="w-2.5 h-2.5 shrink-0" />
                          {t("vocab.suggestions_title")}
                        </span>
                        <ul className="pl-3.5 list-disc space-y-0.5 text-[11px] text-amber-200/80 leading-snug">
                          {decoded.suggestions.map((tip, idx) => (
                            <li key={idx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  decoded.rawText && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
                      {decoded.rawText}
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

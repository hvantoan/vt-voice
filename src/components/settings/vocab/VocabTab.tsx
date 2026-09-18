import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GraduationCap,
  BookMarked,
  ClipboardPaste,
  Sparkles,
} from "lucide-react";
import { StudySentence } from "./types";
import { StudyMode } from "./StudyMode";
import { VocabNotebook } from "./VocabNotebook";
import { PasteSentencesModal } from "./PasteSentencesModal";
import { GenerateSentencesModal } from "./GenerateSentencesModal";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const VocabTab: React.FC = () => {
  const { t } = useI18n();
  const [sentences, setSentences] = useState<StudySentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [mode, setMode] = useState<"practice" | "notebook">("practice");
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadSentences = useCallback(async () => {
    try {
      const items = await invoke<StudySentence[]>("get_study_sentences", { limit: 100 });
      setSentences(items);
      setCurrentIndex((prev) => (items.length > 0 && prev >= items.length ? items.length - 1 : prev));
    } catch (err) {
      console.error("Failed to load study sentences:", err);
    }
  }, []);

  useEffect(() => {
    void loadSentences();
  }, [loadSentences]);

  const handleDeleteSentence = async (id: string) => {
    try {
      await invoke("delete_study_sentence", { id });
      setSentences((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (currentIndex >= next.length && next.length > 0) {
          setCurrentIndex(next.length - 1);
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to delete sentence:", err);
    }
  };

  const handleSentencesAdded = (newItems: StudySentence[]) => {
    if (newItems.length === 0) return;
    setSentences((prev) => [...newItems, ...prev]);
    setCurrentIndex(0);
    setMode("practice");
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 shrink-0">
        {/* Chuyển đổi giữa Chế độ Luyện dịch và Sổ tay từ vựng */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => setMode("practice")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
              mode === "practice"
                ? "bg-zinc-800 text-emerald-300 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>{t("vocab.mode_practice")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("notebook");
              setRefreshTrigger((prev) => prev + 1);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
              mode === "notebook"
                ? "bg-zinc-800 text-sky-300 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>{t("vocab.mode_notebook")}</span>
          </button>
        </div>

        {/* Các nút hành động nhanh */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPasteOpen(true)}
            className="h-7 px-2.5 text-xs bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-zinc-100 cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <span>{t("vocab.action_paste")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsGenerateOpen(true)}
            className="h-7 px-2.5 text-xs bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-zinc-100 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" />
            <span>{t("vocab.action_generate")}</span>
          </Button>
        </div>
      </div>

      {/* 2. Main Content View */}
      <div className="flex-1 overflow-y-auto pr-1">
        {mode === "practice" ? (
          <StudyMode
            sentence={sentences[currentIndex] ?? null}
            currentIndex={currentIndex}
            totalCount={sentences.length}
            onPrev={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            onNext={() => setCurrentIndex((prev) => Math.min(sentences.length - 1, prev + 1))}
            onDeleteSentence={handleDeleteSentence}
            onAttemptSaved={() => setRefreshTrigger((prev) => prev + 1)}
          />
        ) : (
          <VocabNotebook onRefreshTrigger={refreshTrigger} />
        )}
      </div>

      {/* 3. Modals */}
      <PasteSentencesModal
        open={isPasteOpen}
        onOpenChange={setIsPasteOpen}
        onSentencesAdded={handleSentencesAdded}
      />

      <GenerateSentencesModal
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onSentencesAdded={handleSentencesAdded}
      />
    </div>
  );
};

export default VocabTab;

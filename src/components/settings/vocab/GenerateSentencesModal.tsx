import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StudySentence } from "./types";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";

interface GenerateSentencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSentencesAdded: (sentences: StudySentence[]) => void;
}

const TOPICS = [
  { id: "Daily", key: "topic_daily" },
  { id: "Business", key: "topic_business" },
  { id: "Technology", key: "topic_technology" },
  { id: "Travel", key: "topic_travel" },
  { id: "Academic", key: "topic_academic" },
] as const;

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export const GenerateSentencesModal: React.FC<GenerateSentencesModalProps> = ({
  open,
  onOpenChange,
  onSentencesAdded,
}) => {
  const { t } = useI18n();
  const [topic, setTopic] = useState<string>("Business");
  const [level, setLevel] = useState<string>("B1");
  const [direction, setDirection] = useState<"en_to_vi" | "vi_to_en">("en_to_vi");
  const [count, setCount] = useState<number>(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const generated = await invoke<StudySentence[]>("generate_study_sentences", {
        topic,
        level,
        sourceLang: direction === "en_to_vi" ? "en" : "vi",
        targetLang: direction === "en_to_vi" ? "vi" : "en",
        count,
      });

      onSentencesAdded(generated);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(translateIpcError(err, t));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 p-5 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {t("vocab.generate_modal_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            {t("vocab.generate_modal_desc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Direction Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">
              {t("vocab.direction_label")}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setDirection("en_to_vi")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  direction === "en_to_vi"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {t("vocab.direction_en_vi")}
              </button>
              <button
                type="button"
                onClick={() => setDirection("vi_to_en")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  direction === "vi_to_en"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {t("vocab.direction_vi_en")}
              </button>
            </div>
          </div>

          {/* Topic Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">
              {t("vocab.topic_label")}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TOPICS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTopic(item.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border text-left transition-all cursor-pointer ${
                    topic === item.id
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {t(`vocab.${item.key}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Level Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">
              {t("vocab.level_label")}
            </label>
            <div className="grid grid-cols-6 gap-1">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`py-1 rounded text-xs font-mono font-semibold border text-center transition-all cursor-pointer ${
                    level === lvl
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Count Select */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300">
              {t("vocab.count_label")}
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setCount(cnt)}
                  className={`w-7 h-7 rounded text-xs font-mono font-medium border flex items-center justify-center cursor-pointer transition-all ${
                    count === cnt
                      ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                      : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded p-2">
              {error}
            </p>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8 bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300 cursor-pointer"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isGenerating}
              className="text-xs h-8 bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
            >
              {isGenerating ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t("vocab.generating")}
                </span>
              ) : (
                t("vocab.generate_submit")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

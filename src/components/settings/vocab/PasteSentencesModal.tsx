import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Clipboard, Loader2 } from "lucide-react";
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

interface PasteSentencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSentencesAdded: (sentences: StudySentence[]) => void;
}

export const PasteSentencesModal: React.FC<PasteSentencesModalProps> = ({
  open,
  onOpenChange,
  onSentencesAdded,
}) => {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [direction, setDirection] = useState<"en_to_vi" | "vi_to_en">("en_to_vi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const saved = await invoke<StudySentence[]>("save_pasted_sentences", {
        text: trimmed,
        sourceLang: direction === "en_to_vi" ? "en" : "vi",
        targetLang: direction === "en_to_vi" ? "vi" : "en",
        category: "Pasted",
      });

      onSentencesAdded(saved);
      setText("");
      onOpenChange(false);
    } catch (err: unknown) {
      setError(translateIpcError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 p-5 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Clipboard className="w-4 h-4 text-emerald-400" />
            {t("vocab.paste_modal_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            {t("vocab.paste_modal_desc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-2">
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

          <textarea
            autoFocus
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("vocab.paste_placeholder")}
            className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 resize-none focus:outline-none focus:border-zinc-600 transition-colors leading-relaxed"
          />

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
              disabled={!text.trim() || isSubmitting}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                t("vocab.paste_submit")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

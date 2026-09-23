import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Tag, Sparkles, Loader2, CheckCircle2, AlertCircle, BookMarked } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";
import { cn } from "@/lib/utils";
import type { EnrichedVocabResult, TargetVocabItem } from "./types";

interface TokenizedSentenceProps {
  text: string;
  notedWords: string[];
  onToggleWord: (word: string, isCtrl: boolean) => void;
  onRemoveWord: (word: string) => void;
  onClearAll?: () => void;
  targetVocab?: TargetVocabItem[] | null;
  sourceLang?: string;
  targetLang?: string;
  onVocabSaved?: () => void;
}
export interface SentenceToken {
  text: string;
  isWord: boolean;
}

export function tokenizeSentence(text: string): SentenceToken[] {
  const regex = /([\p{L}\p{N}_\-]+|[^\p{L}\p{N}\s_\-]+|\s+)/gu;
  const result: SentenceToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const part = match[0];
    const isWord = /[\p{L}\p{N}]/u.test(part);
    result.push({ text: part, isWord });
  }
  return result;
}

type EnrichStatus = "idle" | "loading" | "success" | "error";

interface TokenPopoverState {
  quickTranslation: string | null;
  quickLoading: boolean;
  quickError: string | null;
  enrichStatus: EnrichStatus;
  enrichError: string | null;
  saveStatus: EnrichStatus;
  saveError: string | null;
  enriched: EnrichedVocabResult | null;
  saved: boolean;
}

const EMPTY_POPOVER_STATE: TokenPopoverState = {
  quickTranslation: null,
  quickLoading: false,
  quickError: null,
  enrichStatus: "idle",
  enrichError: null,
  saveStatus: "idle",
  saveError: null,
  enriched: null,
  saved: false,
};

// Style chung cho các icon button trong popover tra từ
const ICON_BTN =
  "flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none";

export const TokenizedSentence: React.FC<TokenizedSentenceProps> = ({
  text,
  notedWords,
  onToggleWord,
  onRemoveWord,
  onClearAll,
  targetVocab,
  sourceLang,
  targetLang,
  onVocabSaved,
}) => {
  const { t } = useI18n();
  const [openTokenIdx, setOpenTokenIdx] = React.useState<number | null>(null);
  const [popoverStates, setPopoverStates] = React.useState<Record<number, TokenPopoverState>>({});

  // Tách câu thành các token từ vựng và dấu câu/khoảng trắng
  // Giữ lại dấu câu và khoảng cách để câu hiển thị tự nhiên
  const tokens = React.useMemo(() => tokenizeSentence(text), [text]);

  // Reset trạng thái popover khi đổi câu
  React.useEffect(() => {
    setOpenTokenIdx(null);
    setPopoverStates({});
  }, [text]);

  const updatePopoverState = (idx: number, patch: Partial<TokenPopoverState>) => {
    setPopoverStates((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? EMPTY_POPOVER_STATE), ...patch },
    }));
  };

  // Tra nghĩa nhanh: ưu tiên targetVocab của câu (0ms), fallback IPC quick_translate_word.
  const lookupQuickTranslation = React.useCallback(
    async (idx: number, word: string) => {
      const wordKey = word.trim().toLowerCase();
      const known = targetVocab?.find(
        (v) => v.word.trim().toLowerCase() === wordKey
      );
      if (known?.meaning) {
        updatePopoverState(idx, {
          quickTranslation: known.meaning,
          quickLoading: false,
          quickError: null,
        });
        return;
      }

      updatePopoverState(idx, { quickLoading: true, quickError: null });
      try {
        const translated = await invoke<string>("quick_translate_word", {
          word: word.trim(),
          sourceLang: sourceLang ?? "auto",
          targetLang: targetLang ?? "vi",
        });
        updatePopoverState(idx, {
          quickTranslation: translated || null,
          quickLoading: false,
          quickError: translated ? null : t("vocab.enrich_error"),
        });
      } catch (err) {
        const rawError = err instanceof Error ? err.message : String(err);
        updatePopoverState(idx, {
          quickLoading: false,
          quickError: translateIpcError(rawError, t),
        });
      }
    },
    [targetVocab, sourceLang, targetLang, t]
  );

  const openToken = (idx: number, word: string) => {
    setOpenTokenIdx(idx);
    const state = popoverStates[idx];
    if (!state || (!state.quickTranslation && !state.quickLoading && !state.quickError)) {
      void lookupQuickTranslation(idx, word);
    }
  };

  const handleOpenChange = (idx: number, word: string, open: boolean) => {
    if (open) {
      openToken(idx, word);
    } else if (openTokenIdx === idx) {
      setOpenTokenIdx(null);
    }
  };

  const handleEnrich = async (idx: number, word: string) => {
    updatePopoverState(idx, { enrichStatus: "loading", enrichError: null });
    try {
      const result = await invoke<EnrichedVocabResult>("enrich_vocab_with_ai", {
        word: word.trim(),
        sentenceContext: text,
        sourceLang: sourceLang ?? "en",
        targetLang: targetLang ?? "vi",
      });
      updatePopoverState(idx, {
        enrichStatus: "success",
        enriched: result,
        saved: true,
        quickTranslation: result.translation || popoverStates[idx]?.quickTranslation || null,
      });
      onVocabSaved?.();
    } catch (err) {
      const rawError = err instanceof Error ? err.message : String(err);
      updatePopoverState(idx, {
        enrichStatus: "error",
        enrichError: translateIpcError(rawError, t),
      });
    }
  };

  const handleQuickSave = async (idx: number, word: string) => {
    const state = popoverStates[idx];
    updatePopoverState(idx, { saveStatus: "loading", saveError: null });
    try {
      await invoke("save_single_vocab", {
        word: word.trim(),
        sourceContext: text,
        translation: state?.quickTranslation ?? null,
        notes: null,
      });
      updatePopoverState(idx, { saveStatus: "success", saved: true });
      onVocabSaved?.();
    } catch (err) {
      const rawError = err instanceof Error ? err.message : String(err);
      updatePopoverState(idx, {
        saveStatus: "error",
        saveError: translateIpcError(rawError, t),
      });
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Vùng hiển thị câu với các token có thể tương tác */}
      <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-lg text-sm text-zinc-200 leading-relaxed select-none">
        {tokens.map((token, idx) => {
          if (!token.isWord) {
            return (
              <span key={idx} className="text-zinc-400">
                {token.text}
              </span>
            );
          }

          const wordKey = token.text.trim().toLowerCase();
          const noted = notedWords.some((nw) => nw.trim().toLowerCase() === wordKey);
          const state = popoverStates[idx] ?? EMPTY_POPOVER_STATE;
          const knownVocab = targetVocab?.find(
            (v) => v.word.trim().toLowerCase() === wordKey
          );
          const partOfSpeech =
            state.enriched?.partOfSpeech ?? knownVocab?.wordType ?? knownVocab?.type;

          return (
            <Popover
              key={idx}
              open={openTokenIdx === idx}
              onOpenChange={(open) => handleOpenChange(idx, token.text, open)}
            >
              <PopoverTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    // Ctrl+Click: đánh dấu nhanh không mở popover
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleWord(token.text.trim(), true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (e.ctrlKey || e.metaKey) {
                        // Ctrl+Enter/Space: đánh dấu nhanh không mở popover
                        e.stopPropagation();
                        onToggleWord(token.text.trim(), true);
                      } else {
                        // Enter/Space thường: mở popover (asChild span không có
                        // kích hoạt bàn phím gốc của Radix)
                        if (openTokenIdx === idx) {
                          setOpenTokenIdx(null);
                        } else {
                          openToken(idx, token.text);
                        }
                      }
                    }
                  }}
                  className={cn(
                    "inline-block px-1 py-0.5 mx-0.5 rounded cursor-pointer transition-all text-xs font-medium outline-none",
                    noted
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                      : "hover:bg-zinc-800 hover:text-zinc-100 text-zinc-200"
                  )}
                  title={t("vocab.click_hint")}
                >
                  {token.text}
                </span>
              </PopoverTrigger>

              <PopoverContent
                data-vocab-popover
                side="bottom"
                sideOffset={6}
                align="center"
                avoidCollisions={true}
                collisionPadding={12}
                className="w-72 max-w-[calc(100vw-32px)] p-3 bg-zinc-950/95 border border-zinc-800 rounded-xl shadow-2xl z-50 text-xs"
              >
                <TooltipProvider delayDuration={200}>
                {/* Header: từ vựng + từ loại + nút đóng */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-zinc-800/70">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-emerald-400 truncate">
                      {token.text.trim()}
                    </span>
                    {state.enriched?.phonetic && (
                      <span className="text-[10px] text-violet-300/90 font-mono truncate">
                        {state.enriched.phonetic}
                      </span>
                    )}
                    {partOfSpeech && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-zinc-700 bg-zinc-900/80 text-zinc-400 shrink-0"
                      >
                        {partOfSpeech}
                      </Badge>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setOpenTokenIdx(null)}
                        className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-0.5 shrink-0"
                        aria-label={t("common.close")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("common.close")}</TooltipContent>
                  </Tooltip>
                </div>

                {/* Bản dịch nhanh */}
                <div className="py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    {t("vocab.quick_translation")}
                  </span>
                  {state.quickLoading ? (
                    <div className="flex items-center gap-1.5 mt-1 text-zinc-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[11px]">{t("vocab.enriching")}</span>
                    </div>
                  ) : state.quickError ? (
                    <p className="mt-1 text-[11px] text-rose-400">{state.quickError}</p>
                  ) : state.quickTranslation ? (
                    <p className="mt-0.5 text-xs text-zinc-200 leading-relaxed">
                      {state.quickTranslation}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] italic text-zinc-500">—</p>
                  )}
                </div>

                {/* Kết quả AI làm giàu */}
                {state.enriched && (
                  <div className="flex flex-col gap-1 py-1.5 border-t border-zinc-800/70">
                    {state.enriched.explanation && (
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {state.enriched.explanation}
                      </p>
                    )}
                    {state.enriched.example && (
                      <div className="text-[11px] bg-zinc-900/60 rounded p-1.5 border border-zinc-800/60">
                        <p className="italic text-zinc-300">“{state.enriched.example}”</p>
                        {state.enriched.exampleTranslation && (
                          <p className="text-zinc-500 mt-0.5">
                            → {state.enriched.exampleTranslation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Trạng thái lỗi AI / lưu nhanh */}
                {(state.enrichStatus === "error" && state.enrichError) ||
                (state.saveStatus === "error" && state.saveError) ? (
                  <div className="flex items-center gap-1.5 py-1.5 text-[11px] text-rose-400">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="flex-1">
                      {state.enrichError ?? state.saveError}
                    </span>
                  </div>
                ) : null}

                {/* Hàng nút hành động: icon button + tooltip chi tiết */}
                  <div className="flex items-center gap-1 pt-1.5 border-t border-zinc-800/70">
                    {state.saved ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn(ICON_BTN, "text-emerald-400 cursor-default")}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {t("vocab.saved_to_notebook")}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        {/* AI enrich: làm giàu + lưu vào sổ tay */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <button
                                type="button"
                                onClick={() => void handleEnrich(idx, token.text)}
                                disabled={
                                  state.enrichStatus === "loading" ||
                                  state.saveStatus === "loading"
                                }
                                aria-label={t("vocab.enrich_with_ai")}
                                className={cn(
                                  ICON_BTN,
                                  "bg-emerald-600/90 hover:bg-emerald-500 text-white"
                                )}
                              >
                                {state.enrichStatus === "loading" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {state.enrichStatus === "loading"
                              ? t("vocab.enriching")
                              : state.enrichStatus === "error"
                              ? t("vocab.retry")
                              : t("vocab.enrich_with_ai")}
                          </TooltipContent>
                        </Tooltip>

                        {/* Lưu nhanh nghĩa hiện tại, không qua AI */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <button
                                type="button"
                                onClick={() => void handleQuickSave(idx, token.text)}
                                disabled={
                                  state.saveStatus === "loading" ||
                                  state.enrichStatus === "loading"
                                }
                                aria-label={t("vocab.quick_save")}
                                className={cn(
                                  ICON_BTN,
                                  "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                )}
                              >
                                {state.saveStatus === "loading" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <BookMarked className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {state.saveStatus === "loading"
                              ? t("vocab.enriching")
                              : t("vocab.quick_save")}
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}

                    {/* Đánh dấu / bỏ đánh dấu từ trong câu */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onToggleWord(token.text.trim(), true)}
                          aria-label={noted ? t("vocab.untag_word") : t("vocab.tag_word")}
                          className={cn(
                            ICON_BTN,
                            "ml-auto",
                            noted
                              ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                          )}
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {noted ? t("vocab.untag_word") : t("vocab.tag_word")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {/* Dải hiển thị các từ vựng đang được note */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
            <Tag className="w-3 h-3 text-emerald-400 shrink-0" />
            {t("vocab.noted_words")}:
          </span>

          {notedWords.length === 0 ? (
            <span className="text-[11px] italic text-zinc-500">
              {t("vocab.no_tokens_noted")}
            </span>
          ) : (
            notedWords.map((word, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="bg-emerald-950/40 border-emerald-500/30 text-emerald-300 text-xs py-0 px-2 flex items-center gap-1"
              >
                <span>{word}</span>
                <button
                  type="button"
                  onClick={() => onRemoveWord(word)}
                  className="hover:text-emerald-100 text-emerald-400 ml-0.5 cursor-pointer"
                  title="Remove"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))
          )}
        </div>

        {notedWords.length > 1 && onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer underline"
          >
            {t("common.clear")}
          </button>
        )}
      </div>
    </div>
  );
};

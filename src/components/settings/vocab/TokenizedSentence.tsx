import React from "react";
import { X, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TokenizedSentenceProps {
  text: string;
  notedWords: string[];
  onToggleWord: (word: string, isCtrl: boolean) => void;
  onRemoveWord: (word: string) => void;
  onClearAll?: () => void;
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


export const TokenizedSentence: React.FC<TokenizedSentenceProps> = ({
  text,
  notedWords,
  onToggleWord,
  onRemoveWord,
  onClearAll,
}) => {
  const { t } = useI18n();

  // Tách câu thành các token từ vựng và dấu câu/khoảng trắng
  // Giữ lại dấu câu và khoảng cách để câu hiển thị tự nhiên
  const tokens = React.useMemo(() => tokenizeSentence(text), [text]);
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

          return (
            <span
              key={idx}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                const isCtrl = e.ctrlKey || e.metaKey;
                onToggleWord(token.text.trim(), isCtrl);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleWord(token.text.trim(), e.ctrlKey || e.metaKey);
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

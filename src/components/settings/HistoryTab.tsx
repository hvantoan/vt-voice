import React, { useState } from "react";
import { Copy, Check, Trash2, Search, Clock, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface HistoryItem {
  id: string;
  timestamp: string;
  rawText: string;
  polishedText: string;
  sttDurationMs: number;
  llmDurationMs: number;
  totalDurationMs: number;
}

interface HistoryTabProps {
  history: HistoryItem[];
  onClearHistory: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ history, onClearHistory }) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredHistory = history.filter(
    (item) =>
      item.polishedText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rawText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nội dung đã nhập..."
            className="w-full bg-zinc-900/60 border-zinc-800 pl-9 pr-3 h-9 text-xs text-zinc-200 focus-visible:ring-emerald-500/50"
          />
        </div>

        {history.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearHistory}
            className="h-9 px-3 border-zinc-800 bg-zinc-900 hover:bg-rose-950/40 hover:border-rose-800/60 text-zinc-400 hover:text-rose-300 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            <span>Xóa lịch sử</span>
          </Button>
        )}
      </div>

      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
          <Clock className="w-8 h-8 stroke-[1.5] mb-2 opacity-60" />
          <div className="text-xs font-medium text-zinc-400">Chưa có lịch sử nhập liệu</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Các đoạn giọng nói được dán sẽ tự động lưu tại đây.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredHistory.map((item) => (
            <Card
              key={item.id}
              className="bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700/80 transition-colors"
            >
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{item.timestamp}</span>
                    <Badge
                      variant="secondary"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-emerald-400 font-normal"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      {item.totalDurationMs}ms
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(item.id, item.polishedText)}
                    className="h-7 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400 mr-1" />
                        <span className="text-emerald-400 font-medium">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-xs text-zinc-100 font-medium leading-relaxed">
                  {item.polishedText}
                </div>

                {item.rawText !== item.polishedText && (
                  <div className="text-[11px] text-zinc-500 italic bg-zinc-950/40 px-2 py-1 rounded border border-zinc-800/40">
                    Gốc: {item.rawText}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

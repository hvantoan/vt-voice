import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Eye, EyeOff, Check, AlertCircle, Loader2, Sparkles, Plus, X, RotateCcw } from "lucide-react";

interface AiTabProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  customVocab: string[];
  setCustomVocab: (vocab: string[]) => void;
  defaultPrompt: string;
}

export const AiTab: React.FC<AiTabProps> = ({
  apiKey,
  setApiKey,
  systemPrompt,
  setSystemPrompt,
  customVocab,
  setCustomVocab,
  defaultPrompt,
}) => {
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [latencyResult, setLatencyResult] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState<string>("");

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestError("Vui lòng nhập API key trước khi kiểm tra.");
      return;
    }

    setTestingConnection(true);
    setLatencyResult(null);
    setTestError(null);

    try {
      const ms = await invoke<number>("test_ai_connection", { apiKey });
      setLatencyResult(ms);
    } catch (err: unknown) {
      if (typeof err === "string") {
        setTestError(err);
      } else if (err instanceof Error) {
        setTestError(err.message);
      } else {
        setTestError("Không thể kết nối đến Groq API.");
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTag.trim();
    if (trimmed && !customVocab.includes(trimmed)) {
      setCustomVocab([...customVocab, trimmed]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setCustomVocab(customVocab.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-6">
      {/* API Key Box */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-zinc-200">Groq API Key</label>
            <span className="text-[10px] text-zinc-500 font-mono">Bảo mật bằng Windows Credential Vault</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang thử...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kiểm tra</span>
                </>
              )}
            </button>
          </div>

          {/* Test Status Feedback */}
          {latencyResult !== null && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>Kết nối thành công! Độ trễ phản hồi: <strong>{latencyResult} ms</strong></span>
            </div>
          )}

          {testError && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{testError}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60 text-xs">
          <div>
            <div className="text-[11px] text-zinc-400">Speech-to-Text Model</div>
            <div className="font-mono text-zinc-200 mt-0.5">whisper-large-v3-turbo</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400">Grammar Polish Model</div>
            <div className="font-mono text-zinc-200 mt-0.5">llama-3.3-70b-versatile</div>
          </div>
        </div>
      </div>

      {/* Custom Vocabulary */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-zinc-200 mb-1">Từ vựng chuyên ngành (Custom Vocabulary)</h4>
          <p className="text-[11px] text-zinc-400">
            Các thuật ngữ kỹ thuật, tên thư viện, từ mượn tiếng Anh được đưa vào prompt mồi để Whisper nhận dạng chính xác.
          </p>
        </div>

        <form onSubmit={handleAddTag} className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Thêm từ mới (vd: Next.js, Redis, Tailwind)..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {customVocab.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700/80 text-[11px] font-mono text-zinc-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-zinc-400 hover:text-rose-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* System Prompt Customization */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-zinc-200">System Prompt (Chỉnh sửa ngữ pháp)</h4>
          <button
            type="button"
            onClick={() => setSystemPrompt(defaultPrompt)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mặc định</span>
          </button>
        </div>
        <textarea
          rows={4}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-zinc-300 leading-relaxed focus:outline-none focus:border-emerald-500/60"
        />
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Plus,
  X,
  RotateCcw,
  RefreshCw,
  Zap,
  ShieldCheck,
  KeyRound,
  Server,
} from "lucide-react";

export interface SttModelInfo {
  id: string;
  name: string;
  description?: string;
  provider: string;
  is_recommended: boolean;
}

interface AiTabProps {
  activeProvider: string;
  setActiveProvider: (p: string) => void;
  sttModel: string;
  setSttModel: (m: string) => void;
  enablePolish: boolean;
  setEnablePolish: (v: boolean) => void;
  customEndpoint: string;
  setCustomEndpoint: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  customVocab: string[];
  setCustomVocab: (vocab: string[]) => void;
  defaultPrompt: string;
}

export const AiTab: React.FC<AiTabProps> = ({
  activeProvider,
  setActiveProvider,
  sttModel,
  setSttModel,
  enablePolish,
  setEnablePolish,
  customEndpoint,
  setCustomEndpoint,
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
  const [savingKey, setSavingKey] = useState<boolean>(false);
  const [keySavedMessage, setKeySavedMessage] = useState<string | null>(null);
  const [latencyResult, setLatencyResult] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [models, setModels] = useState<SttModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [newTag, setNewTag] = useState<string>("");

  // Fetch masked key and models whenever activeProvider changes
  useEffect(() => {
    setLatencyResult(null);
    setTestError(null);
    setKeySavedMessage(null);

    // 1. Fetch masked API key for active provider
    invoke<string | null>("get_masked_provider_api_key", { provider: activeProvider })
      .then((masked) => {
        setApiKey(masked || "");
      })
      .catch(() => {
        setApiKey("");
      });

    // 2. Fetch available models for active provider
    loadModels(activeProvider, false);
  }, [activeProvider]);

  const loadModels = async (provider: string, forceRefresh: boolean) => {
    setLoadingModels(true);
    try {
      const list = await invoke<SttModelInfo[]>("get_available_stt_models", {
        provider,
        forceRefresh,
      });
      setModels(list);

      // If current sttModel is not valid for this provider, select recommended or first
      if (!list.some((m) => m.id === sttModel)) {
        const recommended = list.find((m) => m.is_recommended);
        if (recommended) {
          setSttModel(recommended.id);
        } else if (list.length > 0) {
          setSttModel(list[0].id);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    if (newProvider === activeProvider) return;
    setActiveProvider(newProvider);
    // Set appropriate default STT model
    if (newProvider === "groq") {
      setSttModel("whisper-large-v3-turbo");
    } else if (newProvider === "openrouter") {
      setSttModel("openai/whisper-1");
    } else if (newProvider === "custom") {
      setSttModel("whisper-1");
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    // Don't re-save if it's already masked bullets
    if (apiKey.includes("••••")) {
      setKeySavedMessage("Key đã được bảo mật");
      setTimeout(() => setKeySavedMessage(null), 2000);
      return;
    }

    setSavingKey(true);
    try {
      await invoke("save_provider_api_key", {
        provider: activeProvider,
        key: apiKey.trim(),
      });
      setKeySavedMessage("Đã lưu vào Windows Vault!");
      // Reload masked key
      const masked = await invoke<string | null>("get_masked_provider_api_key", {
        provider: activeProvider,
      });
      if (masked) setApiKey(masked);
      setTimeout(() => setKeySavedMessage(null), 2500);
    } catch (err: unknown) {
      setTestError(typeof err === "string" ? err : "Không thể lưu key vào Vault.");
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestError("Vui lòng nhập API key trước khi kiểm tra.");
      return;
    }

    setTestingConnection(true);
    setLatencyResult(null);
    setTestError(null);

    try {
      const ms = await invoke<number>("test_provider_connection", {
        provider: activeProvider,
        apiKey: apiKey.trim(),
        endpoint: customEndpoint.trim() ? customEndpoint.trim() : null,
      });
      setLatencyResult(ms);
    } catch (err: unknown) {
      if (typeof err === "string") {
        setTestError(err);
      } else if (err instanceof Error) {
        setTestError(err.message);
      } else {
        setTestError(`Không thể kết nối đến nhà cung cấp ${activeProvider}.`);
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
      {/* 1. Provider Selector */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-200">
            Nhà cung cấp AI (Provider)
          </label>
          <span className="text-[10px] text-zinc-500 font-mono">
            Độc lập API key và mô hình
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleProviderChange("groq")}
            className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
              activeProvider === "groq"
                ? "bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-sm"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <div className="flex items-center gap-1.5 w-full">
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold">Groq</span>
              <span className="ml-auto text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                Siêu nhanh
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1">
              Độ trễ thấp nhất &lt;250ms
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleProviderChange("openrouter")}
            className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
              activeProvider === "openrouter"
                ? "bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-sm"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <div className="flex items-center gap-1.5 w-full">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold">OpenRouter</span>
              <span className="ml-auto text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                Đa Model
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1">
              OpenAI-compatible gateway
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleProviderChange("custom")}
            className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
              activeProvider === "custom"
                ? "bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-sm"
                : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            }`}
          >
            <div className="flex items-center gap-1.5 w-full">
              <Server className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-xs font-semibold">Tùy chỉnh</span>
              <span className="ml-auto text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-medium">
                Custom
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1">
              Endpoint Whisper tự host
            </span>
          </button>
        </div>

        {/* Custom Endpoint URL Input */}
        {activeProvider === "custom" && (
          <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-300">
              Custom STT Audio Endpoint URL
            </label>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="http://localhost:8000/v1/audio/transcriptions"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/60"
            />
            <p className="text-[10px] text-zinc-500">
              Tương thích chuẩn OpenAI POST /audio/transcriptions với multipart/form-data.
            </p>
          </div>
        )}
      </div>

      {/* 2. API Key Box */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <label className="text-xs font-semibold text-zinc-200">
                API Key ({activeProvider === "groq" ? "Groq" : activeProvider === "openrouter" ? "OpenRouter" : "Custom"})
              </label>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Windows Credential Vault (DPAPI)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  activeProvider === "groq"
                    ? "gsk_..."
                    : activeProvider === "openrouter"
                    ? "sk-or-v1-..."
                    : "Bearer key..."
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? "Ẩn Key" : "Hiện Key"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveKey}
              disabled={savingKey || !apiKey.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
            >
              {savingKey ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Lưu Key</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || !apiKey.trim()}
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

          {/* Feedback Badges */}
          {keySavedMessage && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>{keySavedMessage}</span>
            </div>
          )}

          {latencyResult !== null && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>
                Kết nối thành công! Độ trễ phản hồi: <strong>{latencyResult} ms</strong>
              </span>
            </div>
          )}

          {testError && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{testError}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. STT Model Selector */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-200">
            Mô hình Nhận diện Giọng nói (STT Model)
          </label>
          <button
            type="button"
            onClick={() => loadModels(activeProvider, true)}
            disabled={loadingModels}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingModels ? "animate-spin" : ""}`} />
            <span>Tải lại danh sách</span>
          </button>
        </div>

        <select
          value={sttModel}
          onChange={(e) => setSttModel(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/60"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.is_recommended ? "★ Khuyên dùng" : ""} ({m.id})
            </option>
          ))}
          {!models.some((m) => m.id === sttModel) && (
            <option value={sttModel}>{sttModel}</option>
          )}
        </select>
        <p className="text-[10px] text-zinc-500">
          Mô hình Whisper chuyển đổi âm thanh giọng nói thành văn bản thô theo chuẩn OpenAI.
        </p>
      </div>

      {/* 4. Pure STT Mode Toggle */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-zinc-200">
                Tắt AI sửa tiếng (Chế độ Pure STT siêu tốc)
              </h4>
              {!enablePolish && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  &lt;300ms
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Bỏ qua bước LLM để dán văn bản ngay lập tức (&lt;300ms). Whisper vẫn nhận diện đúng từ kỹ thuật Việt-Anh nhờ từ vựng nạp sẵn.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!enablePolish}
              onChange={(e) => setEnablePolish(!e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* 5. Custom Vocabulary */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-zinc-200 mb-1">
            Từ vựng chuyên ngành (Custom Vocabulary)
          </h4>
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

      {/* 6. System Prompt Customization (only shown if enablePolish is true) */}
      {enablePolish ? (
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-zinc-200">
              System Prompt (Chỉnh sửa ngữ pháp bằng LLM)
            </h4>
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
      ) : (
        <div className="p-3 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-800/80 text-center">
          <p className="text-[11px] text-zinc-500">
            Chế độ Pure STT đang bật: Bỏ qua bước sửa ngữ pháp bằng LLM để đạt độ trễ tối thiểu &lt;300ms.
          </p>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
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
  ChevronsUpDown,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";

export interface SttModelInfo {
  id: string;
  name: string;
  description?: string;
  provider: string;
  is_recommended: boolean;
}
export interface ProviderOption {
  id: string;
  name: string;
  nameKey?: string;
  badge: string;
  badgeKey?: string;
  description: string;
  descriptionKey?: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
}

export const PROVIDERS: ProviderOption[] = [
  {
    id: "groq",
    name: "Groq Cloud",
    nameKey: "ai.providers.groq.name",
    badge: "Ultra Fast",
    badgeKey: "ai.providers.groq.badge",
    description: "Lowest latency (<250ms), optimized for real-time speed",
    descriptionKey: "ai.providers.groq.description",
    icon: Zap,
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    nameKey: "ai.providers.openrouter.name",
    badge: "Multi-Model",
    badgeKey: "ai.providers.openrouter.badge",
    description: "Multi-model gateway (Whisper, Gemini Flash, ...)",
    descriptionKey: "ai.providers.openrouter.description",
    icon: Sparkles,
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  {
    id: "custom",
    name: "Self-hosted / Custom",
    nameKey: "ai.providers.custom.name",
    badge: "Custom",
    badgeKey: "ai.providers.custom.badge",
    description: "OpenAI-compatible local endpoint (Whisper.cpp, vLLM)",
    descriptionKey: "ai.providers.custom.description",
    icon: Server,
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  },
];

interface AiTabProps {
  activeProvider: string;
  setActiveProvider: (p: string) => void;
  sttModel: string;
  setSttModel: (m: string) => void;
  enablePolish: boolean;
  setEnablePolish: (v: boolean) => void;
  customEndpoint: string;
  setCustomEndpoint: (url: string) => void;
  onCustomEndpointCommit?: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  onKeyChange?: () => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  onSystemPromptCommit?: (prompt: string) => void;
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
  onCustomEndpointCommit,
  apiKey,
  setApiKey,
  onKeyChange,
  systemPrompt,
  setSystemPrompt,
  onSystemPromptCommit,
  customVocab,
  setCustomVocab,
  defaultPrompt,
}) => {
  const { t } = useI18n();
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<boolean>(false);
  const [keySavedMessage, setKeySavedMessage] = useState<string | null>(null);
  const [providerKeyStatus, setProviderKeyStatus] = useState<
    Record<string, boolean>
  >({});
  const [isEditingKey, setIsEditingKey] = useState<boolean>(false);
  const [deletingKey, setDeletingKey] = useState<boolean>(false);
  const [latencyResult, setLatencyResult] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [models, setModels] = useState<SttModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [newTag, setNewTag] = useState<string>("");
  const [openModelCombobox, setOpenModelCombobox] = useState<boolean>(false);
  const [modelSearch, setModelSearch] = useState<string>("");

  const lastCommittedEndpointRef = useRef(customEndpoint);
  const lastCommittedPromptRef = useRef(systemPrompt);
  const onCustomEndpointCommitRef = useRef(onCustomEndpointCommit);
  onCustomEndpointCommitRef.current = onCustomEndpointCommit;
  const onSystemPromptCommitRef = useRef(onSystemPromptCommit);
  onSystemPromptCommitRef.current = onSystemPromptCommit;

  useEffect(() => {
    lastCommittedEndpointRef.current = customEndpoint;
  }, [defaultPrompt, activeProvider]);

  useEffect(() => {
    lastCommittedPromptRef.current = defaultPrompt;
  }, [defaultPrompt]);

  useEffect(() => {
    if (customEndpoint === lastCommittedEndpointRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      lastCommittedEndpointRef.current = customEndpoint;
      onCustomEndpointCommitRef.current?.(customEndpoint);
    }, 800);
    return () => clearTimeout(timer);
  }, [customEndpoint]);

  useEffect(() => {
    if (systemPrompt === lastCommittedPromptRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      lastCommittedPromptRef.current = systemPrompt;
      onSystemPromptCommitRef.current?.(systemPrompt);
    }, 800);
    return () => clearTimeout(timer);
  }, [systemPrompt]);


  const checkKeyStatuses = async () => {
    const statuses: Record<string, boolean> = {};
    for (const p of PROVIDERS) {
      try {
        const has = await invoke<boolean>("has_provider_api_key", {
          provider: p.id,
        });
        statuses[p.id] = has;
      } catch {
        statuses[p.id] = false;
      }
    }
    setProviderKeyStatus(statuses);
  };

  // Fetch masked key and models whenever activeProvider changes
  useEffect(() => {
    setLatencyResult(null);
    setTestError(null);
    setKeySavedMessage(null);
    setIsEditingKey(false);
    setShowKey(false);

    // 1. Fetch masked API key for active provider
    invoke<string | null>("get_masked_provider_api_key", {
      provider: activeProvider,
    })
      .then((masked) => {
        setApiKey(masked || "");
      })
      .catch(() => {
        setApiKey("");
      });

    // 2. Check key status across all providers
    checkKeyStatuses();

    // 3. Load models for active provider
    loadModels(activeProvider);
  }, [activeProvider]);

  const loadModels = (provider: string, forceRefresh: boolean = false) => {
    setLoadingModels(true);
    invoke<SttModelInfo[]>("get_available_stt_models", {
      provider,
      forceRefresh,
    })
      .then((list) => {
        setModels(list);
        if (list.length > 0 && !list.some((m) => m.id === sttModel)) {
          const rec = list.find((m) => m.is_recommended) || list[0];
          setSttModel(rec.id);
        }
      })
      .catch(() => {
        setModels([]);
      })
      .finally(() => {
        setLoadingModels(false);
      });
  };

  const handleProviderChange = (newProvider: string) => {
    if (newProvider === activeProvider) return;
    setActiveProvider(newProvider);
    invoke("set_active_provider", { provider: newProvider }).catch(() => {});
  };

  const handleSaveKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed || trimmed.includes("••••")) return;
    setSavingKey(true);
    setKeySavedMessage(null);
    setTestError(null);

    try {
      await invoke("save_provider_api_key", {
        provider: activeProvider,
        key: trimmed,
      });
      setKeySavedMessage(t("ai.key_saved"));
      setTimeout(() => setKeySavedMessage(null), 4000);
      setIsEditingKey(false);
      setShowKey(false);
      await checkKeyStatuses();
      onKeyChange?.();
      loadModels(activeProvider, true);
      invoke<string | null>("get_masked_provider_api_key", {
        provider: activeProvider,
      })
        .then((masked) => {
          if (masked) setApiKey(masked);
        })
        .catch(() => {});
    } catch (err: unknown) {
      setTestError(translateIpcError(err, t));
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async () => {
    setDeletingKey(true);
    setTestError(null);
    setKeySavedMessage(null);
    setLatencyResult(null);

    try {
      await invoke("delete_provider_api_key", { provider: activeProvider });
      setApiKey("");
      setIsEditingKey(false);
      setShowKey(false);
      await checkKeyStatuses();
      onKeyChange?.();
      setKeySavedMessage(t("ai.key_deleted"));
      setTimeout(() => setKeySavedMessage(null), 3000);
      loadModels(activeProvider, true);
    } catch (err: unknown) {
      setTestError(translateIpcError(err, t));
    } finally {
      setDeletingKey(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestError(null);
    setLatencyResult(null);

    const testKey =
      apiKey.trim() && !apiKey.includes("••••") ? apiKey.trim() : null;

    try {
      const latency = await invoke<number>("test_provider_connection", {
        provider: activeProvider,
        apiKey: testKey,
        endpoint: activeProvider === "custom" ? customEndpoint.trim() : null,
      });
      setLatencyResult(latency);
    } catch (err: unknown) {
      setTestError(translateIpcError(err, t));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newTag.trim();
    if (tag && !customVocab.includes(tag)) {
      setCustomVocab([...customVocab, tag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setCustomVocab(customVocab.filter((t) => t !== tag));
  };
  const currentProvider = PROVIDERS.find((p) => p.id === activeProvider) || {
    id: activeProvider,
    name: activeProvider,
    nameKey: undefined,
    badge: "Custom",
    badgeKey: "ai.providers.custom.badge",
    description: "Custom provider",
    descriptionKey: "ai.providers.custom.description",
    icon: Server,
    badgeColor: "bg-zinc-800 text-zinc-300 border-zinc-700",
  };
  const isKeyConfigured = !!(
    providerKeyStatus[activeProvider] ||
    (apiKey && apiKey.includes("••••"))
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* 1. Provider Selector */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-200">
              {t("ai.provider_title")}
            </label>
            <span className="text-[10px] text-zinc-500 font-mono">
              {t("ai.provider_independent_hint")}
            </span>
          </div>

          <Select value={activeProvider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-full bg-zinc-950/80 border-zinc-800 text-xs text-zinc-200 h-auto min-h-[50px] py-2 px-3 rounded-lg focus:ring-emerald-500/50">
              <div className="flex flex-col items-start gap-0.5 text-left w-full pr-2 overflow-hidden">
                {/* 1. Title + chip */}
                <div className="flex items-center gap-2">
                  <currentProvider.icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="font-semibold text-zinc-200">
                    {currentProvider.nameKey ? t(currentProvider.nameKey) : currentProvider.name}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${currentProvider.badgeColor}`}
                  >
                    {currentProvider.badgeKey ? t(currentProvider.badgeKey) : currentProvider.badge}
                  </span>
                  {providerKeyStatus[activeProvider] ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      ✓ {t("ai.has_key")}
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {t("ai.no_key")}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 pl-5.5 leading-tight truncate w-full">
                  {currentProvider.descriptionKey ? t(currentProvider.descriptionKey) : currentProvider.description}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-zinc-950/95 backdrop-blur-xl border-zinc-800 text-zinc-200 w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)]">
              {PROVIDERS.map((p) => {
                const Icon = p.icon;
                return (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="text-xs focus:bg-zinc-900 focus:text-zinc-100 cursor-pointer py-2 rounded-lg"
                  >
                    <div className="flex flex-col gap-0.5 text-left w-full min-w-0">
                      {/* 1. Title + chip */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-semibold text-zinc-200 truncate">
                          {p.nameKey ? t(p.nameKey) : p.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${p.badgeColor}`}
                        >
                          {p.badgeKey ? t(p.badgeKey) : p.badge}
                        </span>
                        {providerKeyStatus[p.id] ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ✓ {t("ai.has_key")}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                            {t("ai.no_key")}
                          </span>
                        )}
                      </div>
                      {/* 2. Subtitle: textsize nhỏ */}
                      <span className="text-[11px] text-zinc-400 pl-5.5 leading-relaxed break-words whitespace-normal">
                        {p.descriptionKey ? t(p.descriptionKey) : p.description}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {/* Custom Endpoint URL Input */}
          {activeProvider === "custom" && (
            <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-300">
                {t("ai.custom_endpoint_label")}
              </label>
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                onBlur={() => {
                  if (customEndpoint !== lastCommittedEndpointRef.current) {
                    lastCommittedEndpointRef.current = customEndpoint;
                    onCustomEndpointCommit?.(customEndpoint);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                placeholder={t("ai.custom_endpoint_placeholder")}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/60"
              />
              <p className="text-[10px] text-zinc-500">
                {t("ai.endpoint_format_hint")}
              </p>
            </div>
          )}
        </div>

        {/* 2. API Key Box */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <label className="text-xs font-semibold text-zinc-200">
                  {t("ai.api_key_title")} ({currentProvider.nameKey ? t(currentProvider.nameKey) : currentProvider.name})
                </label>
                {isKeyConfigured ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                    <CheckCircle2 className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" />
                  </span>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono cursor-help">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>{t("ai.vault_badge")}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-950/95 border-zinc-800 text-xs text-zinc-300">
                  {t("ai.vault_tooltip")}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  readOnly={isKeyConfigured && !isEditingKey}
                  autoFocus={isEditingKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    activeProvider === "groq"
                      ? t("ai.api_key_placeholder_groq")
                      : activeProvider === "openrouter"
                        ? t("ai.api_key_placeholder_openrouter")
                        : t("ai.api_key_placeholder_custom")
                  }
                  className={cn(
                    "w-full rounded-lg pl-3 pr-10 py-2 text-xs font-mono transition-colors focus:outline-none",
                    isKeyConfigured && !isEditingKey
                      ? "bg-zinc-950/60 border border-emerald-500/30 text-emerald-300/90 cursor-default select-all"
                      : "bg-zinc-950/90 border border-zinc-800 text-zinc-200 focus:border-emerald-500/60",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  title={
                    showKey
                      ? t("ai.hide_api_key")
                      : t("ai.show_api_key")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {isKeyConfigured && !isEditingKey ? (
                <>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
                    title={t("ai.test_connection_tooltip")}
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{t("ai.testing_connection")}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t("ai.test_connection")}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingKey(true);
                      setApiKey("");
                      setShowKey(false);
                      setTestError(null);
                      setLatencyResult(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
                    title={t("ai.change_key_tooltip")}
                  >
                    <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{t("ai.change_key")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteKey}
                    disabled={deletingKey}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-900 hover:bg-rose-950/50 border border-zinc-800 hover:border-rose-800/60 text-xs font-medium text-zinc-400 hover:text-rose-300 transition-colors disabled:opacity-50"
                    title={t("ai.delete_key_tooltip")}
                  >
                    {deletingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={
                      savingKey || !apiKey.trim() || apiKey.includes("••••")
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {savingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{t("common.save")}</span>
                      </>
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
                        <span>{t("ai.testing_connection")}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t("ai.test_connection")}</span>
                      </>
                    )}
                  </button>

                  {isEditingKey && isKeyConfigured && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingKey(false);
                        invoke<string | null>("get_masked_provider_api_key", {
                          provider: activeProvider,
                        }).then((masked) => {
                          if (masked) setApiKey(masked);
                        });
                      }}
                      className="px-2.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      title={t("common.cancel")}
                    >
                      {t("common.cancel")}
                    </button>
                  )}
                </>
              )}
            </div>

            {isKeyConfigured && !isEditingKey ? (
              <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>
                  {t("ai.key_configured_help_prefix")}{" "}
                  <strong>{t("ai.test_connection")}</strong>{" "}
                  {t("ai.key_configured_help_mid")}{" "}
                  <strong>{t("ai.change_key")}</strong>{" "}
                  {t("ai.key_configured_help_suffix")}
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-1.5">
                {t("ai.key_unconfigured_help_prefix")}{" "}
                <strong>{t("common.save")}</strong>
                {t("ai.key_unconfigured_help_suffix")}
              </p>
            )}
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
                <span>{t("ai.connection_success_latency")}</span>
                <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  {latencyResult} ms
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

        {/* 3. STT Model Selector with shadcn Select */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-200">
              {t("ai.stt_model_title")}
            </label>
            <button
              type="button"
              onClick={() => loadModels(activeProvider, true)}
              disabled={loadingModels}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3 h-3 ${loadingModels ? "animate-spin" : ""}`}
              />
              <span>{t("ai.reload_models")}</span>
            </button>
          </div>

          <Popover open={openModelCombobox} onOpenChange={setOpenModelCombobox}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={openModelCombobox}
                className="w-full bg-zinc-950/80 border border-zinc-800 text-xs font-mono text-zinc-200 h-auto min-h-[48px] py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex items-center justify-between gap-2 hover:bg-zinc-900/60 transition-colors cursor-pointer text-left"
              >
                {(() => {
                  const selectedModel = models.find((m) => m.id === sttModel);
                  if (selectedModel) {
                    return (
                      <div className="flex flex-col items-start gap-0.5 text-left w-full min-w-0 pr-2 overflow-hidden">
                        {/* 1. Title + chip */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-zinc-200 font-sans truncate">
                            {selectedModel.name}
                          </span>
                          {selectedModel.is_recommended && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans font-medium shrink-0">
                              ★ {t("ai.recommended")}
                            </span>
                          )}
                        </div>
                        {/* 2. Subtitle: textsize nhỏ */}
                        <span className="text-[10px] text-zinc-500 font-mono leading-tight truncate w-full">
                          {selectedModel.description || selectedModel.id}
                        </span>
                      </div>
                    );
                  }
                  if (sttModel) {
                    return (
                      <div className="flex flex-col items-start gap-0.5 text-left w-full min-w-0 pr-2 overflow-hidden">
                        <span className="font-semibold text-zinc-200 font-sans truncate">
                          {sttModel}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {t("common.custom")}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <span className="text-zinc-500 font-sans">
                      {t("ai.search_models")}
                    </span>
                  );
                })()}
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400 opacity-60 ml-2" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-trigger-width)] p-0 bg-zinc-950/95 backdrop-blur-xl border-zinc-800 text-zinc-200 shadow-2xl overflow-hidden"
            >
              <Command
                className="bg-transparent text-zinc-200"
                filter={(value, search, keywords) => {
                  const text =
                    `${value} ${keywords?.join(" ") || ""}`.toLowerCase();
                  return text.includes(search.toLowerCase()) ? 1 : 0;
                }}
              >
                <CommandInput
                  placeholder={t("ai.search_models")}
                  className="text-xs text-zinc-200 placeholder:text-zinc-500 h-9"
                  value={modelSearch}
                  onValueChange={setModelSearch}
                />
                <CommandList className="max-h-[280px] overflow-y-auto">
                  <CommandEmpty className="p-3 text-center text-xs text-zinc-400">
                    <p className="mb-2">{t("ai.no_models_found")}</p>
                    {modelSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setSttModel(modelSearch.trim());
                          setOpenModelCombobox(false);
                          setModelSearch("");
                        }}
                        className="px-2.5 py-1 text-xs bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{t("ai.use_model")}</span>
                        <span className="font-mono font-semibold text-zinc-100">
                          {modelSearch.trim()}
                        </span>
                      </button>
                    )}
                  </CommandEmpty>

                  <CommandGroup
                    heading={t("ai.available_models")}
                    className="text-zinc-400 text-[10px]"
                  >
                    {models.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={m.id}
                        keywords={[m.name, m.description || ""]}
                        onSelect={() => {
                          setSttModel(m.id);
                          setOpenModelCombobox(false);
                          setModelSearch("");
                        }}
                        className="flex items-center justify-between gap-2 p-2.5 cursor-pointer rounded-lg text-xs hover:bg-zinc-900/80 data-[selected=true]:bg-zinc-900 data-[selected=true]:text-zinc-100"
                      >
                        <div className="flex flex-col gap-0.5 text-left w-full min-w-0">
                          {/* 1. Title + chip */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-zinc-200 font-sans truncate">
                              {m.name}
                            </span>
                            {m.is_recommended && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans font-medium shrink-0">
                                ★ {t("ai.recommended")}
                              </span>
                            )}
                          </div>
                          {/* 2. Subtitle: textsize nhỏ */}
                          <span className="text-[10px] text-zinc-500 font-mono leading-relaxed break-words whitespace-normal">
                            {m.description || m.id}
                          </span>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0 text-emerald-400 ml-2 transition-opacity",
                            sttModel === m.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  {/* Quick-select typed custom ID if not in model list */}
                  {modelSearch.trim() &&
                    !models.some(
                      (m) =>
                        m.id.toLowerCase() === modelSearch.trim().toLowerCase(),
                    ) && (
                      <CommandGroup
                        heading={t("common.custom")}
                        className="text-zinc-400 text-[10px]"
                      >
                        <CommandItem
                          value={`custom:${modelSearch.trim()}`}
                          onSelect={() => {
                            setSttModel(modelSearch.trim());
                            setOpenModelCombobox(false);
                            setModelSearch("");
                          }}
                          className="flex items-center gap-2 p-2 cursor-pointer rounded-lg text-xs hover:bg-zinc-900/80 data-[selected=true]:bg-zinc-900 text-emerald-400"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{t("ai.use_custom_id")}</span>
                          <span className="font-mono font-semibold text-zinc-100 underline decoration-emerald-500/50">
                            {modelSearch.trim()}
                          </span>
                        </CommandItem>
                      </CommandGroup>
                    )}

                  {/* Active custom model */}
                  {sttModel && !models.some((m) => m.id === sttModel) && (
                    <CommandGroup
                      heading={t("ai.custom_model_active")}
                      className="text-zinc-400 text-[10px]"
                    >
                      <CommandItem
                        value={sttModel}
                        onSelect={() => {
                          setOpenModelCombobox(false);
                        }}
                        className="flex items-center justify-between gap-2 p-2.5 cursor-pointer rounded-lg text-xs hover:bg-zinc-900/80 data-[selected=true]:bg-zinc-900"
                      >
                        <div className="flex flex-col gap-0.5 text-left w-full min-w-0">
                          <span className="font-semibold text-zinc-200 truncate">
                            {sttModel}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {t("ai.custom_model")}
                          </span>
                        </div>
                        <Check className="h-4 w-4 shrink-0 text-emerald-400 ml-2 opacity-100" />
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <p className="text-[10px] text-zinc-500">
            {t("ai.stt_model_hint")}
          </p>
        </div>

        {/* 4. Pure STT Mode Toggle with shadcn Switch */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-zinc-200">
                  {t("ai.polish_title")}
                </h4>
                {!enablePolish && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    &lt;300ms
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 max-w-[440px] leading-relaxed">
                {t("ai.polish_desc")}
              </p>
            </div>

            <Switch
              checked={!enablePolish}
              onCheckedChange={(checked) => setEnablePolish(!checked)}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
        </div>

        {/* 5. Custom Vocabulary */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 mb-1">
              {t("ai.custom_vocab_title")}
            </h4>
            <p className="text-[11px] text-zinc-400">
              {t("ai.custom_vocab_desc")}
            </p>
          </div>

          <form onSubmit={handleAddTag} className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={t("ai.custom_vocab_placeholder")}
              className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("ai.custom_vocab_add")}</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {customVocab.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/80 text-[11px] font-mono text-zinc-200"
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

        {/* 6. System Prompt Customization */}
        {enablePolish ? (
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-200">
                {t("ai.system_prompt_title")}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSystemPrompt(defaultPrompt);
                  if (defaultPrompt !== lastCommittedPromptRef.current) {
                    lastCommittedPromptRef.current = defaultPrompt;
                    onSystemPromptCommit?.(defaultPrompt);
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t("common.default")}</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              onBlur={() => {
                if (systemPrompt !== lastCommittedPromptRef.current) {
                  lastCommittedPromptRef.current = systemPrompt;
                  onSystemPromptCommit?.(systemPrompt);
                }
              }}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg p-2.5 text-xs font-mono text-zinc-300 leading-relaxed focus:outline-none focus:border-emerald-500/60"
            />
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-800/80 text-center">
            <p className="text-[11px] text-zinc-500">
              {t("ai.pure_stt_active_desc")}
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

import React, { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import {
  Sliders,
  Mic,
  Sparkles,
  Clock,
  X,
  Minus,
  Check,
  Loader2,
} from "lucide-react";

import { GeneralTab } from "./GeneralTab";
import { AudioTab } from "./AudioTab";
import { AiTab } from "./AiTab";
import { HistoryTab, HistoryItem } from "./HistoryTab";
import { KeyBinding } from "./HotkeyRecorder";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n, LocaleOption } from "@/lib/i18n";
type TabId = "general" | "audio" | "ai" | "history";

export interface AppConfig {
  hotkey_mode: "push_to_talk" | "toggle";
  hotkey_binding: KeyBinding;
  audio_device_name: string | null;
  autostart: boolean;
  start_minimized: boolean;
  active_provider: string;
  stt_model: string;
  polish_model: string;
  enable_polish: boolean;
  custom_endpoint: string | null;
  system_prompt: string;
  custom_vocabulary: string[];
  vad_timeout_ms: number;
  locale?: LocaleOption;
}

export interface RawAppConfig {
  hotkey_mode?: "push_to_talk" | "toggle";
  hotkey_binding?: KeyBinding;
  audio_device_name?: string | null;
  autostart?: boolean;
  start_minimized?: boolean;
  active_provider?: string;
  ai_provider?: string;
  stt_model?: string;
  polish_model?: string;
  enable_polish?: boolean;
  custom_endpoint?: string | null;
  system_prompt?: string;
  custom_vocabulary?: string[];
  vad_timeout_ms?: number;
  locale?: LocaleOption;
}

function hasConfigChanges(
  current: AppConfig,
  patch: Partial<AppConfig>,
): boolean {
  for (const key of Object.keys(patch) as (keyof AppConfig)[]) {
    const val = patch[key];
    if (val === undefined) continue;

    const cur = current[key];
    if (key === "hotkey_binding") {
      const curB = cur as KeyBinding | undefined;
      const valB = val as KeyBinding | undefined;
      if (
        !curB ||
        !valB ||
        curB.code !== valB.code ||
        curB.name !== valB.name ||
        !!curB.ctrl !== !!valB.ctrl ||
        !!curB.alt !== !!valB.alt ||
        !!curB.shift !== !!valB.shift ||
        !!curB.win !== !!valB.win
      ) {
        return true;
      }
    } else if (key === "custom_vocabulary") {
      const curV = (cur as string[]) || [];
      const valV = (val as string[]) || [];
      if (
        curV.length !== valV.length ||
        curV.some((item, idx) => item !== valV[idx])
      ) {
        return true;
      }
    } else {
      if (cur !== val) {
        return true;
      }
    }
  }
  return false;
}

export const SettingsLayout: React.FC = () => {
  const { t, settingLocale, setLocale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [hotkeyMode, setHotkeyMode] = useState<"push_to_talk" | "toggle">(
    "push_to_talk",
  );
  const [hotkeyBinding, setHotkeyBinding] = useState<KeyBinding>({
    code: 0xa5,
    name: "Right Alt",
    ctrl: false,
    alt: false,
    shift: false,
    win: false,
  });
  const [autostart, setAutostart] = useState<boolean>(false);
  const [startMinimized, setStartMinimized] = useState<boolean>(true);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [vadTimeout, setVadTimeout] = useState<number>(700);

  const [activeProvider, setActiveProvider] = useState<string>("groq");
  const [sttModel, setSttModel] = useState<string>("whisper-large-v3-turbo");
  const [enablePolish, setEnablePolish] = useState<boolean>(true);
  const [customEndpoint, setCustomEndpoint] = useState<string>("");

  const [hasAiKey, setHasAiKey] = useState<boolean>(false);

  const checkAiKey = useCallback(async (provider: string) => {
    try {
      const has = await invoke<boolean>("has_provider_api_key", { provider });
      setHasAiKey(has);
    } catch {
      setHasAiKey(false);
    }
  }, []);

  const [apiKey, setApiKey] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [customVocab, setCustomVocab] = useState<string[]>([]);
  const [defaultPrompt, setDefaultPrompt] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const configRef = useRef<AppConfig | null>(null);
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  const saveConfigPatch = useCallback(
    async (patch: Partial<AppConfig>) => {
      const current = configRef.current;
      if (!current) return;

      if (!hasConfigChanges(current, patch)) {
        return;
      }

      const updated: AppConfig = {
        ...current,
        ...patch,
      };
      configRef.current = updated;

      // Synchronize local states
      if (patch.hotkey_mode !== undefined) setHotkeyMode(patch.hotkey_mode);
      if (patch.hotkey_binding !== undefined)
        setHotkeyBinding(patch.hotkey_binding);
      if (patch.audio_device_name !== undefined)
        setSelectedDevice(patch.audio_device_name);
      if (patch.autostart !== undefined) setAutostart(patch.autostart);
      if (patch.start_minimized !== undefined)
        setStartMinimized(patch.start_minimized);
      if (patch.active_provider !== undefined) {
        setActiveProvider(patch.active_provider);
        checkAiKey(patch.active_provider);
      }
      if (patch.stt_model !== undefined) setSttModel(patch.stt_model);
      if (patch.enable_polish !== undefined)
        setEnablePolish(patch.enable_polish);
      if (patch.custom_endpoint !== undefined)
        setCustomEndpoint(patch.custom_endpoint || "");
      if (patch.system_prompt !== undefined)
        setSystemPrompt(patch.system_prompt);
      if (patch.custom_vocabulary !== undefined)
        setCustomVocab(patch.custom_vocabulary);
      if (patch.vad_timeout_ms !== undefined)
        setVadTimeout(patch.vad_timeout_ms);
      if (patch.locale !== undefined)
        setLocale(patch.locale);
      setIsSaving(true);
      try {
        await invoke("save_app_config", { config: updated });
        setSaveStatus("saved");
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (err) {
        console.error("Failed to auto-save config:", err);
        setSaveStatus("error");
      } finally {
        setIsSaving(false);
      }
    },
    [checkAiKey],
  );

  useEffect(() => {
    return () => {
      clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleHotkeyModeChange = useCallback(
    (mode: "push_to_talk" | "toggle") => {
      saveConfigPatch({ hotkey_mode: mode });
    },
    [saveConfigPatch],
  );

  const handleHotkeyBindingChange = useCallback(
    (binding: KeyBinding) => {
      saveConfigPatch({ hotkey_binding: binding });
    },
    [saveConfigPatch],
  );

  const handleAutostartChange = useCallback(
    async (val: boolean) => {
      try {
        if (val) {
          await enable();
        } else {
          await disable();
        }
      } catch (err) {
        console.warn("Autostart plugin error:", err);
      }
      saveConfigPatch({ autostart: val });
    },
    [saveConfigPatch],
  );

  const handleStartMinimizedChange = useCallback(
    (val: boolean) => {
      saveConfigPatch({ start_minimized: val });
    },
    [saveConfigPatch],
  );
  const handleLocaleChange = useCallback(
    (newLocale: LocaleOption) => {
      setLocale(newLocale);
      saveConfigPatch({ locale: newLocale });
    },
    [setLocale, saveConfigPatch],
  );


  const handleSelectedDeviceChange = useCallback(
    (device: string | null) => {
      saveConfigPatch({ audio_device_name: device });
    },
    [saveConfigPatch],
  );

  const handleVadTimeoutCommit = useCallback(
    (ms: number) => {
      saveConfigPatch({ vad_timeout_ms: ms });
    },
    [saveConfigPatch],
  );

  const handleActiveProviderChange = useCallback(
    (p: string) => {
      saveConfigPatch({ active_provider: p });
    },
    [saveConfigPatch],
  );

  const handleSttModelChange = useCallback(
    (m: string) => {
      saveConfigPatch({ stt_model: m });
    },
    [saveConfigPatch],
  );

  const handleEnablePolishChange = useCallback(
    (v: boolean) => {
      saveConfigPatch({ enable_polish: v });
    },
    [saveConfigPatch],
  );

  const handleCustomEndpointCommit = useCallback(
    (url: string) => {
      saveConfigPatch({
        custom_endpoint: url.trim() ? url.trim() : null,
      });
    },
    [saveConfigPatch],
  );

  const handleSystemPromptCommit = useCallback(
    (prompt: string) => {
      saveConfigPatch({ system_prompt: prompt });
    },
    [saveConfigPatch],
  );

  const handleCustomVocabChange = useCallback(
    (vocab: string[]) => {
      saveConfigPatch({ custom_vocabulary: vocab });
    },
    [saveConfigPatch],
  );

  // Load configuration on mount
  useEffect(() => {
    invoke<RawAppConfig | null>("get_app_config")
      .then((cfg) => {
        if (cfg) {
          const fullConfig: AppConfig = {
            hotkey_mode: cfg.hotkey_mode || "push_to_talk",
            hotkey_binding: cfg.hotkey_binding || {
              code: 0xa5,
              name: "Right Alt",
              ctrl: false,
              alt: false,
              shift: false,
              win: false,
            },
            audio_device_name: cfg.audio_device_name ?? null,
            autostart: !!cfg.autostart,
            start_minimized:
              cfg.start_minimized !== undefined ? cfg.start_minimized : true,
            active_provider: cfg.active_provider || cfg.ai_provider || "groq",
            stt_model: cfg.stt_model || "whisper-large-v3-turbo",
            polish_model: cfg.polish_model || "llama-3.3-70b-versatile",
            enable_polish:
              cfg.enable_polish !== undefined ? cfg.enable_polish : true,
            custom_endpoint: cfg.custom_endpoint || null,
            system_prompt: cfg.system_prompt || "",
            custom_vocabulary: cfg.custom_vocabulary || [],
            vad_timeout_ms: cfg.vad_timeout_ms || 700,
            locale: (cfg.locale as LocaleOption) || "system",
          };
          if (cfg.locale) {
            setLocale(cfg.locale as LocaleOption);
          }
          configRef.current = fullConfig;
          setHotkeyMode(fullConfig.hotkey_mode);
          setHotkeyBinding(fullConfig.hotkey_binding);
          setSelectedDevice(fullConfig.audio_device_name);
          setAutostart(fullConfig.autostart);
          setStartMinimized(fullConfig.start_minimized);
          setVadTimeout(fullConfig.vad_timeout_ms);
          setActiveProvider(fullConfig.active_provider);
          setSttModel(fullConfig.stt_model);
          setEnablePolish(fullConfig.enable_polish);
          setCustomEndpoint(fullConfig.custom_endpoint || "");
          setSystemPrompt(fullConfig.system_prompt);
          setDefaultPrompt(fullConfig.system_prompt);
          setCustomVocab(fullConfig.custom_vocabulary);

          invoke<string | null>("get_masked_provider_api_key", {
            provider: fullConfig.active_provider,
          })
            .then((key) => {
              if (key) setApiKey(key);
            })
            .catch(() => {});
          checkAiKey(fullConfig.active_provider);
        }
      })
      .catch(() => {});
  }, []);
  const loadHistory = useCallback(async () => {
    try {
      const items = await invoke<HistoryItem[]>("get_transcription_history");
      if (Array.isArray(items)) {
        setHistory(items);
      }
    } catch (err) {
      console.error("Failed to load transcription history:", err);
    }
  }, []);

  // Load transcription history on mount and listen for real-time history updates
  useEffect(() => {
    loadHistory();

    const unlistenUpdatedPromise = listen<HistoryItem>(
      "history-updated",
      (event) => {
        if (event.payload) {
          setHistory((prev) => {
            const filtered = prev.filter((item) => item.id !== event.payload.id);
            return [event.payload, ...filtered].slice(0, 50);
          });
        }
      },
    );

    const unlistenClearedPromise = listen("history-cleared", () => {
      setHistory([]);
    });

    return () => {
      unlistenUpdatedPromise.then((f) => f()).catch(() => {});
      unlistenClearedPromise.then((f) => f()).catch(() => {});
    };
  }, [loadHistory]);

  const handleClearHistory = useCallback(async () => {
    try {
      await invoke("clear_transcription_history");
      setHistory([]);
    } catch (err) {
      console.error("Failed to clear transcription history:", err);
    }
  }, []);

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.hide();
  };

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleTitleBarMouseDown = async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
      try {
        const window = getCurrentWindow();
        await window.startDragging();
      } catch {
        // Ignore dragging errors
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden border border-zinc-800/80 rounded-lg">
      {/* Windows 11 Title Bar */}
      <div
        data-tauri-drag-region
        onMouseDown={handleTitleBarMouseDown}
        className="flex items-center justify-between h-9 px-3 bg-zinc-950/90 border-b border-zinc-800/80 cursor-default select-none"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <img
            src="/tauri.svg"
            alt="vt-voice"
            className="w-4 h-4 object-contain"
          />
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span className="text-xs font-semibold text-zinc-300 tracking-tight">
            vt-voice {t("settings.title")}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">v0.1.0</span>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMinimize}
            className="w-8 h-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded"
            title={t("common.minimize")}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="w-8 h-7 text-zinc-400 hover:text-zinc-100 hover:bg-rose-900/80 rounded"
            title={t("common.close")}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Body with shadcn Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          const tab = val as TabId;
          setActiveTab(tab);
          if (tab === "history") {
            loadHistory();
          }
        }}
        className="flex flex-1 overflow-hidden"
      >
        {/* Sidebar */}
        <aside className="w-48 bg-zinc-900/40 border-r border-zinc-800/80 p-3 flex flex-col justify-between">
          <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 space-y-1">
            <TabsTrigger
              value="general"
              className="flex items-center justify-start gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:border data-[state=active]:border-zinc-700/60 data-[state=active]:shadow-sm transition-colors hover:text-zinc-200 hover:bg-zinc-900/60"
            >
              <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t("settings.tabs.general")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="audio"
              className="flex items-center justify-start gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:border data-[state=active]:border-zinc-700/60 data-[state=active]:shadow-sm transition-colors hover:text-zinc-200 hover:bg-zinc-900/60"
            >
              <Mic className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{t("settings.tabs.audio")}</span>
            </TabsTrigger>

            <TabsTrigger
              value="ai"
              className="flex items-center justify-start gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:border data-[state=active]:border-zinc-700/60 data-[state=active]:shadow-sm transition-colors hover:text-zinc-200 hover:bg-zinc-900/60"
            >
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="flex-1 text-left">{t("settings.tabs.ai")}</span>
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  hasAiKey
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                    : "bg-amber-500/80 shadow-[0_0_6px_rgba(245,158,11,0.6)]",
                )}
                title={
                  hasAiKey ? t("ai.has_key") : t("ai.no_key")
                }
              />
            </TabsTrigger>

            <TabsTrigger
              value="history"
              className="flex items-center justify-start gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:border data-[state=active]:border-zinc-700/60 data-[state=active]:shadow-sm transition-colors hover:text-zinc-200 hover:bg-zinc-900/60"
            >
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{t("settings.tabs.history")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Auto-save Status Indicator */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-900/40">
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span className="text-zinc-300 text-[11px] font-medium">
                  {t("settings.saving")}
                </span>
              </>
            ) : saveStatus === "saved" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-[11px] font-medium">
                  {t("settings.saved")}
                </span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-500 text-[11px]">
                  {t("settings.save_changes")}
                </span>
              </>
            )}
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto p-5">
          <TabsContent
            value="general"
            className="m-0 focus-visible:outline-none"
          >
            <GeneralTab
              locale={settingLocale}
              setLocale={handleLocaleChange}
              hotkeyMode={hotkeyMode}
              setHotkeyMode={handleHotkeyModeChange}
              hotkeyBinding={hotkeyBinding}
              setHotkeyBinding={handleHotkeyBindingChange}
              autostart={autostart}
              setAutostart={handleAutostartChange}
              startMinimized={startMinimized}
              setStartMinimized={handleStartMinimizedChange}
            />
          </TabsContent>

          <TabsContent value="audio" className="m-0 focus-visible:outline-none">
            <AudioTab
              selectedDevice={selectedDevice}
              setSelectedDevice={handleSelectedDeviceChange}
              vadTimeout={vadTimeout}
              setVadTimeout={setVadTimeout}
              onVadTimeoutCommit={handleVadTimeoutCommit}
            />
          </TabsContent>

          <TabsContent value="ai" className="m-0 focus-visible:outline-none">
            <AiTab
              activeProvider={activeProvider}
              setActiveProvider={handleActiveProviderChange}
              sttModel={sttModel}
              setSttModel={handleSttModelChange}
              enablePolish={enablePolish}
              setEnablePolish={handleEnablePolishChange}
              customEndpoint={customEndpoint}
              setCustomEndpoint={setCustomEndpoint}
              onCustomEndpointCommit={handleCustomEndpointCommit}
              apiKey={apiKey}
              setApiKey={setApiKey}
              onKeyChange={() => checkAiKey(activeProvider)}
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              onSystemPromptCommit={handleSystemPromptCommit}
              customVocab={customVocab}
              setCustomVocab={handleCustomVocabChange}
              defaultPrompt={defaultPrompt}
            />
          </TabsContent>

          <TabsContent
            value="history"
            className="m-0 focus-visible:outline-none"
          >
            <HistoryTab
              history={history}
              onClearHistory={handleClearHistory}
            />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sliders, Mic, Sparkles, Clock, X, Minus, Check, Save } from "lucide-react";

import { GeneralTab } from "./GeneralTab";
import { AudioTab } from "./AudioTab";
import { AiTab } from "./AiTab";
import { HistoryTab, HistoryItem } from "./HistoryTab";
import { KeyBinding } from "./HotkeyRecorder";

type TabId = "general" | "audio" | "ai" | "history";

export const SettingsLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [hotkeyMode, setHotkeyMode] = useState<"push_to_talk" | "toggle">("push_to_talk");
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

  const [apiKey, setApiKey] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [customVocab, setCustomVocab] = useState<string[]>([]);
  const [defaultPrompt, setDefaultPrompt] = useState<string>("");

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load configuration on mount
  useEffect(() => {
    invoke<any>("get_app_config")
      .then((cfg) => {
        if (cfg) {
          setHotkeyMode(cfg.hotkey_mode);
          setHotkeyBinding(cfg.hotkey_binding);
          setSelectedDevice(cfg.audio_device_name);
          setAutostart(cfg.autostart);
          setStartMinimized(cfg.start_minimized);
          setVadTimeout(cfg.vad_timeout_ms || 700);
          setSystemPrompt(cfg.system_prompt || "");
          setDefaultPrompt(cfg.system_prompt || "");
          setCustomVocab(cfg.custom_vocabulary || []);
        }
      })
      .catch(() => {});

    invoke<string | null>("get_api_key")
      .then((key) => {
        if (key) setApiKey(key);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const config = {
        hotkey_mode: hotkeyMode,
        hotkey_binding: hotkeyBinding,
        audio_device_name: selectedDevice,
        autostart,
        start_minimized: startMinimized,
        ai_provider: "groq",
        stt_model: "whisper-large-v3-turbo",
        polish_model: "llama-3.3-70b-versatile",
        system_prompt: systemPrompt,
        custom_vocabulary: customVocab,
        vad_timeout_ms: vadTimeout,
      };

      await invoke("save_app_config", { config });
      if (apiKey.trim()) {
        await invoke("save_api_key", { key: apiKey.trim() });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Ignore save error
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    // Hide to tray rather than close process
    const window = getCurrentWindow();
    await window.hide();
  };

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden border border-zinc-800/80 rounded-lg">
      {/* Windows 11 Title Bar */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between h-9 px-3 bg-zinc-950/90 border-b border-zinc-800/80 cursor-default"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span className="text-xs font-semibold text-zinc-300 tracking-tight">vt-voice Cài đặt</span>
          <span className="text-[10px] text-zinc-500 font-mono">v0.1.0</span>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            onClick={handleMinimize}
            className="flex items-center justify-center w-8 h-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-7 text-zinc-400 hover:text-zinc-100 hover:bg-rose-900/80 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Body: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 bg-zinc-900/40 border-r border-zinc-800/80 p-3 flex flex-col justify-between">
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "general"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Chung (General)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("audio")}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "audio"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Mic className="w-4 h-4 text-rose-400" />
              <span>Âm thanh (Audio)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "ai"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>AI & Mô hình</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Lịch sử nhập</span>
            </button>
          </nav>

          {/* Save Button */}
          <div className="pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-semibold shadow transition-all ${
                saveSuccess
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã lưu!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Đang lưu..." : "Lưu cài đặt"}</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto p-5">
          {activeTab === "general" && (
            <GeneralTab
              hotkeyMode={hotkeyMode}
              setHotkeyMode={setHotkeyMode}
              hotkeyBinding={hotkeyBinding}
              setHotkeyBinding={setHotkeyBinding}
              autostart={autostart}
              setAutostart={setAutostart}
              startMinimized={startMinimized}
              setStartMinimized={setStartMinimized}
            />
          )}

          {activeTab === "audio" && (
            <AudioTab
              selectedDevice={selectedDevice}
              setSelectedDevice={setSelectedDevice}
              vadTimeout={vadTimeout}
              setVadTimeout={setVadTimeout}
            />
          )}

          {activeTab === "ai" && (
            <AiTab
              apiKey={apiKey}
              setApiKey={setApiKey}
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              customVocab={customVocab}
              setCustomVocab={setCustomVocab}
              defaultPrompt={defaultPrompt}
            />
          )}

          {activeTab === "history" && (
            <HistoryTab
              history={history}
              onClearHistory={() => setHistory([])}
            />
          )}
        </main>
      </div>
    </div>
  );
};

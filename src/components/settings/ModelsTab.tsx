import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Mic,
  Globe,
  Sparkles,
  Plus,
  X,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ProviderConfig } from "./providers/ProviderDialog";
import {
  FeatureBindingCard,
  FeatureProfile,
} from "./providers/FeatureBindingCard";
export interface ModelsTabProps {
  providers: ProviderConfig[];
  enablePolish: boolean;
  setEnablePolish: (v: boolean) => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  onSystemPromptCommit?: (prompt: string) => void;
  customVocab: string[];
  setCustomVocab: (vocab: string[]) => void;
  defaultPrompt: string;
  setActiveProvider?: (p: string) => void;
  setSttModel?: (m: string) => void;
  setTranslateModel?: (model: string) => void;
}
export const ModelsTab: React.FC<ModelsTabProps> = ({
  providers,
  enablePolish,
  setEnablePolish,
  systemPrompt,
  setSystemPrompt,
  onSystemPromptCommit,
  customVocab,
  setCustomVocab,
  defaultPrompt,
  setActiveProvider,
  setSttModel,
  setTranslateModel,
}) => {
  const { t } = useI18n();

  // State cấu hình Feature Profiles
  const [featureProfiles, setFeatureProfiles] = useState<
    Record<string, FeatureProfile>
  >({
    stt: { provider_id: "groq", model_id: "whisper-large-v3-turbo" },
    polish: { provider_id: "groq", model_id: "llama-3.3-70b-versatile" },
    translate: { provider_id: "google_free", model_id: null },
  });

  // State từ vựng custom vocab
  const [newTag, setNewTag] = useState("");

  const lastCommittedPromptRef = useRef(systemPrompt);
  const onSystemPromptCommitRef = useRef(onSystemPromptCommit);
  onSystemPromptCommitRef.current = onSystemPromptCommit;

  // Nạp feature profiles khi mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const profiles = await invoke<Record<string, FeatureProfile>>(
        "get_feature_profiles"
      );
      if (profiles) setFeatureProfiles(profiles);
    } catch (err) {
      console.error("Failed to load feature profiles:", err);
    }
  };

  const handleProfileSaved = (feature: string, profile: FeatureProfile) => {
    setFeatureProfiles((prev) => ({
      ...prev,
      [feature]: profile,
    }));

    // Đồng bộ ngược lại các state cha để tương thích
    if (feature === "stt") {
      setActiveProvider?.(profile.provider_id);
      if (profile.model_id) setSttModel?.(profile.model_id);
    } else if (feature === "translate") {
      if (profile.model_id) setTranslateModel?.(profile.model_id);
    }
  };

  // Thêm tag từ vựng
  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !customVocab.includes(trimmed)) {
      setCustomVocab([...customVocab, trimmed]);
      setNewTag("");
    }
  };

  // Xóa tag từ vựng
  const handleRemoveTag = (tagToRemove: string) => {
    setCustomVocab(customVocab.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-8 pb-8">
      {/* 1. PHÂN HỆ CẤU HÌNH TÍNH NĂNG (FEATURE BINDINGS) */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {t("ai.features.section_title")}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t("ai.features.section_desc")}
          </p>
        </div>

        <div className="space-y-4">
          {/* Feature 1: Nhận diện giọng nói STT */}
          <FeatureBindingCard
            featureKey="stt"
            title={t("ai.features.stt.title")}
            description={t("ai.features.stt.desc")}
            icon={Mic}
            providers={providers}
            currentProfile={featureProfiles.stt}
            onProfileSaved={handleProfileSaved}
          />

          {/* Feature 2: Dịch thuật Translate Overlay */}
          <FeatureBindingCard
            featureKey="translate"
            title={t("ai.features.translate.title")}
            description={t("ai.features.translate.desc")}
            icon={Globe}
            providers={providers}
            currentProfile={featureProfiles.translate}
            onProfileSaved={handleProfileSaved}
            isGoogleFreeSupported={true}
          />

          {/* Feature 3: Sửa lỗi ngữ pháp Polish */}
          <FeatureBindingCard
            featureKey="polish"
            title={t("ai.features.polish.title")}
            description={t("ai.features.polish.desc")}
            icon={Sparkles}
            providers={providers}
            currentProfile={featureProfiles.polish}
            onProfileSaved={handleProfileSaved}
            disabled={!enablePolish}
            extraHeaderControl={
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  {enablePolish ? "Đang bật" : "Tắt (Pure STT)"}
                </span>
                <Switch
                  checked={enablePolish}
                  onCheckedChange={setEnablePolish}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            }
          />
        </div>

        {/* Trình soạn thảo Prompt cho Polish (chỉ hiện khi Polish đang bật) */}
        {enablePolish && (
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-zinc-200">
                  {t("ai.system_prompt_title")}
                </label>
                <p className="text-[11px] text-zinc-400">
                  {t("ai.system_prompt_desc")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSystemPrompt(defaultPrompt);
                  lastCommittedPromptRef.current = defaultPrompt;
                  onSystemPromptCommitRef.current?.(defaultPrompt);
                }}
                className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                {t("ai.system_prompt_reset")}
              </Button>
            </div>

            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              onBlur={() => {
                if (systemPrompt !== lastCommittedPromptRef.current) {
                  lastCommittedPromptRef.current = systemPrompt;
                  onSystemPromptCommitRef.current?.(systemPrompt);
                }
              }}
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-y font-mono leading-relaxed"
            />
          </div>
        )}
      </section>

      {/* 2. TỪ VỰNG CHUYÊN NGÀNH (CUSTOM VOCABULARY) */}
      <section className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            {t("ai.custom_vocab_title")}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t("ai.custom_vocab_desc")}
          </p>
        </div>

        {/* Input thêm từ */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder={t("ai.custom_vocab_placeholder")}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {t("ai.custom_vocab_add")}
          </Button>
        </div>

        {/* Danh sách Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {customVocab.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-zinc-200 text-xs font-mono"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-zinc-500 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};

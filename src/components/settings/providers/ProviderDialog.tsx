import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";

export interface ModelEntry {
  id: string;
  name: string;
  capabilities: string[];
}

export interface ProviderConfig {
  id: string;
  name: string;
  base_url: string;
  is_builtin?: boolean;
  models: ModelEntry[];
}

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: ProviderConfig | null;
  onSaved: (saved: ProviderConfig) => void;
}

export const ProviderDialog: React.FC<ProviderDialogProps> = ({
  open,
  onOpenChange,
  provider,
  onSaved,
}) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = Boolean(provider);

  useEffect(() => {
    if (open) {
      if (provider) {
        setName(provider.name);
        setBaseUrl(provider.base_url);
      } else {
        setName("");
        setBaseUrl("");
      }
      setApiKey("");
      setShowKey(false);
      setTestResult(null);
      setSaveError(null);
    }
  }, [open, provider]);

  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      setTestResult({
        success: false,
        error: "Vui lòng nhập Base URL trước khi kiểm tra",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Nếu không nhập key mới ở chế độ sửa, backend có thể đọc key đã lưu từ vault qua provider.id
      let keyToTest = apiKey.trim() ? apiKey.trim() : undefined;
      if (!keyToTest && provider) {
        try {
          const storedKey = await invoke<string | null>("get_api_key_cmd", {
            provider: provider.id,
          });
          if (storedKey) keyToTest = storedKey;
        } catch {
          // ignore
        }
      }

      const latency = await invoke<number>("test_provider_endpoint_cmd", {
        baseUrl: baseUrl.trim(),
        apiKey: keyToTest || null,
      });

      setTestResult({ success: true, latency });
    } catch (err) {
      const errorMsg = typeof err === "string" ? err : String(err);
      setTestResult({
        success: false,
        error: translateIpcError(errorMsg, t),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError("Vui lòng nhập tên nhà cung cấp");
      return;
    }
    if (!baseUrl.trim()) {
      setSaveError("Vui lòng nhập Base URL");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const id = provider
        ? provider.id
        : name.toLowerCase().replace(/[^a-z0-9]/g, "_") || `p_${Date.now()}`;

      const updatedProvider: ProviderConfig = {
        id,
        name: name.trim(),
        base_url: baseUrl.trim(),
        is_builtin: provider?.is_builtin ?? false,
        models: provider?.models || [],
      };

      await invoke("save_provider", { provider: updatedProvider });

      if (apiKey.trim()) {
        await invoke("save_provider_api_key", {
          provider: id,
          key: apiKey.trim(),
        });
      }

      onSaved(updatedProvider);
      onOpenChange(false);
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      setSaveError(translateIpcError(msg, t));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            {isEdit
              ? t("ai.providers_manager.dialog.edit_title")
              : t("ai.providers_manager.dialog.add_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tên hiển thị */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              {t("ai.providers_manager.dialog.name_label")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("ai.providers_manager.dialog.name_placeholder")}
              className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700"
            />
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              {t("ai.providers_manager.dialog.base_url_label")}
            </label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 font-mono text-xs"
            />
            <p className="text-[11px] text-zinc-500">
              Endpoint phải hỗ trợ chuẩn GET /models và POST /chat/completions hoặc /audio/transcriptions
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              {t("ai.providers_manager.dialog.api_key_label")}
            </label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  isEdit
                    ? t("ai.providers_manager.dialog.api_key_edit_hint")
                    : t("ai.providers_manager.dialog.api_key_placeholder")
                }
                className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 font-mono text-xs pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              {t("ai.vault_badge")} - {t("ai.providers_manager.dialog.vault_hint")}
            </p>
          </div>

          {/* Kết quả Test kết nối */}
          {testResult && (
            <div
              className={`p-2.5 rounded-md text-xs flex items-start gap-2 ${
                testResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <div className="flex-1">
                {testResult.success ? (
                  <span>
                    {t("ai.connection_success_latency")}{" "}
                    <strong className="font-mono text-emerald-200">{testResult.latency} ms</strong>
                  </span>
                ) : (
                  <span>{testResult.error || t("ai.connection_failed", { error: "" })}</span>
                )}
              </div>
            </div>
          )}

          {/* Lỗi Lưu */}
          {saveError && (
            <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-zinc-850">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl.trim()}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 text-xs h-8"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            )}
            {t("ai.providers_manager.dialog.test_btn")}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs h-8"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !name.trim() || !baseUrl.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-medium"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

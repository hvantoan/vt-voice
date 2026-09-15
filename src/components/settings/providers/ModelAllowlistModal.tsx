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
import {
  RefreshCw,
  Search,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Layers,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";
import { ProviderConfig, ModelEntry } from "./ProviderDialog";

export interface DiscoveredModel {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  is_recommended: boolean;
}

interface ModelAllowlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderConfig;
  onUpdated: (provider: ProviderConfig) => void;
}

export const ModelAllowlistModal: React.FC<ModelAllowlistModalProps> = ({
  open,
  onOpenChange,
  provider,
  onUpdated,
}) => {
  const { t } = useI18n();

  const [currentModels, setCurrentModels] = useState<ModelEntry[]>([]);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "stt" | "chat">("all");

  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentModels(provider.models || []);
      setDiscoveredModels([]);
      setSelectedIds(new Set());
      setFetchError(null);
      setActionError(null);
      setSearch("");
      setTab("all");
    }
  }, [open, provider]);

  const handleFetchModels = async () => {
    setIsFetching(true);
    setFetchError(null);
    setActionError(null);

    try {
      const models = await invoke<DiscoveredModel[]>("fetch_provider_models", {
        providerId: provider.id,
      });
      setDiscoveredModels(models || []);
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      setFetchError(translateIpcError(msg, t));
    } finally {
      setIsFetching(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleRemoveModel = async (modelId: string) => {
    setActionError(null);
    try {
      await invoke("remove_model_from_provider", {
        providerId: provider.id,
        modelId,
      });

      const updatedModels = currentModels.filter((m) => m.id !== modelId);
      setCurrentModels(updatedModels);
      onUpdated({
        ...provider,
        models: updatedModels,
      });
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      setActionError(translateIpcError(msg, t));
    }
  };

  const handleAddSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsAdding(true);
    setActionError(null);

    try {
      const modelsToAdd: ModelEntry[] = discoveredModels
        .filter((dm) => selectedIds.has(dm.id))
        .map((dm) => ({
          id: dm.id,
          name: dm.name || dm.id,
          capabilities: dm.capabilities || ["chat"],
        }));

      await invoke("add_models_to_provider", {
        providerId: provider.id,
        models: modelsToAdd,
      });

      // Hợp nhất vào allowlist hiện tại
      const map = new Map<string, ModelEntry>();
      currentModels.forEach((m) => map.set(m.id, m));
      modelsToAdd.forEach((m) => map.set(m.id, m));
      const updatedList = Array.from(map.values());

      setCurrentModels(updatedList);
      setSelectedIds(new Set());
      onUpdated({
        ...provider,
        models: updatedList,
      });
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      setActionError(translateIpcError(msg, t));
    } finally {
      setIsAdding(false);
    }
  };

  // Lọc models khám phá
  const filteredDiscovered = discoveredModels.filter((m) => {
    const matchesSearch =
      search.trim() === "" ||
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (tab === "stt") {
      return m.capabilities.includes("stt");
    } else if (tab === "chat") {
      return m.capabilities.includes("chat");
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b border-zinc-850">
          <DialogTitle className="text-base font-semibold text-zinc-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              {t("ai.providers_manager.allowlist_modal.title", { provider: provider.name })}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Phần 1: Models hiện có trong Allowlist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                {t("ai.providers_manager.allowlist_modal.allowlisted_title")}
                {" ("}
                <span className="text-emerald-400 font-mono">{currentModels.length}</span>
                {")"}
              </label>
            </div>

            {currentModels.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-zinc-800 text-center text-xs text-zinc-500 bg-zinc-900/40">
                {t("ai.providers_manager.no_models_allowlisted")}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 max-h-32 overflow-y-auto">
                {currentModels.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700/60 text-zinc-200 text-xs font-mono"
                  >
                    <span>{m.name || m.id}</span>
                    <span className="text-[10px] uppercase font-sans text-zinc-400 bg-zinc-750 px-1 py-0.2 rounded">
                      {m.capabilities.includes("stt") ? "STT" : "Chat"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(m.id)}
                      className="text-zinc-400 hover:text-red-400 transition-colors ml-0.5"
                      title={t("ai.providers_manager.allowlist_modal.remove_model_tooltip")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Thông báo lỗi thao tác nếu có */}
          {actionError && (
            <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Phần 2: Khám phá model từ API */}
          <div className="space-y-3 pt-2 border-t border-zinc-850">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Khám phá từ API endpoint
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFetchModels}
                disabled={isFetching}
                className="border-zinc-800 text-zinc-200 hover:bg-zinc-900 text-xs h-8 bg-zinc-900/80"
              >
                {isFetching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                )}
                {t("ai.providers_manager.allowlist_modal.fetch_from_api")}
              </Button>
            </div>

            {fetchError && (
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{fetchError}</span>
              </div>
            )}

            {discoveredModels.length > 0 && (
              <div className="space-y-2">
                {/* Search & Tabs filter */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("ai.providers_manager.allowlist_modal.search_placeholder")}
                      className="bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 pl-8 h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="flex bg-zinc-900 p-0.5 rounded-md border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setTab("all")}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        tab === "all" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {t("ai.providers_manager.allowlist_modal.filter_all")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("stt")}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        tab === "stt" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {t("ai.providers_manager.allowlist_modal.filter_stt")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("chat")}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        tab === "chat" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {t("ai.providers_manager.allowlist_modal.filter_chat")}
                    </button>
                  </div>
                </div>

                {/* Danh sách model kết quả */}
                <div className="border border-zinc-800 rounded-lg max-h-56 overflow-y-auto divide-y divide-zinc-850/60 bg-zinc-900/30">
                  {filteredDiscovered.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500">
                      Không tìm thấy model nào phù hợp bộ lọc
                    </div>
                  ) : (
                    filteredDiscovered.map((m) => {
                      const isChecked = selectedIds.has(m.id);
                      const isAlreadyInAllowlist = currentModels.some((cm) => cm.id === m.id);

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleToggleSelect(m.id)}
                          className={`flex items-center justify-between p-2.5 hover:bg-zinc-850/40 cursor-pointer transition-colors ${
                            isChecked ? "bg-emerald-950/20" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-950"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-zinc-200 truncate">{m.id}</span>
                                {m.is_recommended && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-sans">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {t("ai.providers_manager.allowlist_modal.recommended_badge")}
                                  </span>
                                )}
                                {isAlreadyInAllowlist && (
                                  <span className="text-[10px] text-zinc-500 italic">
                                    {t("ai.providers_manager.allowlist_modal.already_added")}
                                  </span>
                                )}
                              </div>
                              {m.description && (
                                <p className="text-[11px] text-zinc-500 truncate max-w-md">{m.description}</p>
                              )}
                            </div>
                          </div>

                          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                            {m.capabilities.includes("stt") ? "STT" : t("ai.providers_manager.allowlist_modal.chat_translate")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-zinc-850 bg-zinc-950 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-zinc-500">
            {selectedIds.size > 0
              ? t("ai.providers_manager.allowlist_modal.selected_count", { count: selectedIds.size })
              : t("ai.providers_manager.allowlist_modal.select_hint")}
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs h-8"
            >
              {t("common.close")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddSelected}
              disabled={isAdding || selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-medium"
            >
              {isAdding && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {t("ai.providers_manager.allowlist_modal.add_selected", {
                count: selectedIds.size,
              })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

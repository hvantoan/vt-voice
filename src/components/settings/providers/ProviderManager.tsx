import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus,
  Zap,
  Server,
  Pencil,
  Trash2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";
import { ProviderConfig, ProviderDialog } from "./ProviderDialog";
import { ModelAllowlistModal } from "./ModelAllowlistModal";

interface ProviderManagerProps {
  providers: ProviderConfig[];
  onProvidersChanged: (providers: ProviderConfig[]) => void;
}

export const ProviderManager: React.FC<ProviderManagerProps> = ({
  providers,
  onProvidersChanged,
}) => {
  const { t } = useI18n();

  // State dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);

  const [allowlistModalOpen, setAllowlistModalOpen] = useState(false);
  const [selectedProviderForModels, setSelectedProviderForModels] = useState<ProviderConfig | null>(null);

  // Latency cache per provider { [id]: { latency?: number, error?: string, loading?: boolean } }
  const [latencies, setLatencies] = useState<
    Record<string, { latency?: number; error?: string; loading?: boolean }>
  >({});

  // Cascade delete alert modal
  const [cascadeAlert, setCascadeAlert] = useState<{
    open: boolean;
    providerName: string;
    errorMessage: string;
  } | null>(null);

  // Xóa confirm dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    provider: ProviderConfig;
  } | null>(null);

  const handleTestLatency = async (provider: ProviderConfig) => {
    setLatencies((prev) => ({
      ...prev,
      [provider.id]: { loading: true },
    }));

    try {
      const latency = await invoke<number>("test_provider_endpoint_cmd", {
        baseUrl: provider.base_url,
        apiKey: null, // Backend sẽ tự lấy từ Windows Vault
        providerId: provider.id,
      });

      setLatencies((prev) => ({
        ...prev,
        [provider.id]: { latency, loading: false },
      }));
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      setLatencies((prev) => ({
        ...prev,
        [provider.id]: { error: translateIpcError(msg, t), loading: false },
      }));
    }
  };

  const handleOpenAdd = () => {
    setEditingProvider(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: ProviderConfig) => {
    setEditingProvider(p);
    setDialogOpen(true);
  };

  const handleOpenAllowlist = (p: ProviderConfig) => {
    setSelectedProviderForModels(p);
    setAllowlistModalOpen(true);
  };

  const handleSavedProvider = (saved: ProviderConfig) => {
    const exists = providers.some((p) => p.id === saved.id);
    let nextList: ProviderConfig[];
    if (exists) {
      nextList = providers.map((p) => (p.id === saved.id ? saved : p));
    } else {
      nextList = [...providers, saved];
    }
    onProvidersChanged(nextList);
  };

  const handleUpdatedFromAllowlist = (updated: ProviderConfig) => {
    const nextList = providers.map((p) => (p.id === updated.id ? updated : p));
    onProvidersChanged(nextList);
    setSelectedProviderForModels(updated);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { provider } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      await invoke("delete_provider_cmd", { id: provider.id });
      const nextList = providers.filter((p) => p.id !== provider.id);
      onProvidersChanged(nextList);
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      setCascadeAlert({
        open: true,
        providerName: provider.name,
        errorMessage: translateIpcError(msg, t),
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            {t("ai.providers_manager.title")}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t("ai.providers_manager.desc")}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-medium shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t("ai.providers_manager.add_provider")}
        </Button>
      </div>

      {/* Cards list */}
      <div className="grid grid-cols-1 gap-3">
        {providers.map((p) => {
          const latInfo = latencies[p.id];

          return (
            <div
              key={p.id}
              className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700/80 transition-all space-y-3"
            >
              {/* Row 1: Name, Status badge & Actions */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm text-zinc-100 truncate" title={p.name}>{p.name}</span>
                  {p.is_builtin ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                      {t("ai.providers_manager.builtin_badge")}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                      {t("ai.providers_manager.custom_badge")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Test Ping button / badge */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTestLatency(p)}
                    disabled={latInfo?.loading}
                    className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800/80"
                  >
                    {latInfo?.loading ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1 text-amber-400" />
                    ) : latInfo?.latency !== undefined ? (
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1 text-amber-400" />
                    )}
                    {latInfo?.loading ? (
                      t("ai.providers_manager.pinging")
                    ) : latInfo?.latency !== undefined ? (
                      <span className="font-mono text-emerald-300">{latInfo.latency} ms</span>
                    ) : (
                      t("ai.providers_manager.test_ping_btn")
                    )}
                  </Button>

                  {/* Sửa */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(p)}
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    title={t("ai.providers_manager.edit_provider")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>

                  {/* Xóa (chặn xóa nếu là builtin hoặc mở confirm) */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm({ open: true, provider: p })}
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                    title={t("ai.providers_manager.delete_provider")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Row 2: Endpoint */}
              <div className="text-xs text-zinc-400 flex items-center gap-1 font-mono truncate">
                <span className="text-zinc-600">URL:</span>
                <span className="truncate text-zinc-300">{p.base_url}</span>
              </div>

              {/* Lỗi test ping nếu có */}
              {latInfo?.error && (
                <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">
                  {latInfo.error}
                </div>
              )}

              {/* Row 3: Models Allowlist Chips & Manage button */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 gap-2">
                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                  {p.models.length === 0 ? (
                    <span className="text-xs text-zinc-500 italic">
                      {t("ai.providers_manager.no_models_allowlisted")}
                    </span>
                  ) : (
                    p.models.slice(0, 4).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-mono"
                      >
                        <span className="truncate max-w-[140px]">{m.name || m.id}</span>
                        <span className="text-[9px] uppercase font-sans text-zinc-500">
                          {m.capabilities.includes("stt") ? "STT" : "Chat"}
                        </span>
                      </span>
                    ))
                  )}
                  {p.models.length > 4 && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {t("ai.providers_manager.more_models", {
                        count: p.models.length - 4,
                      })}
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenAllowlist(p)}
                  className="shrink-0"
                  title={t("ai.providers_manager.allowlist_modal.title", { provider: p.name })}
                >
                  <Layers className="text-emerald-400" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog Thêm/Sửa */}
      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editingProvider}
        onSaved={handleSavedProvider}
      />

      {/* Modal Quản lý Allowlist */}
      {selectedProviderForModels && (
        <ModelAllowlistModal
          open={allowlistModalOpen}
          onOpenChange={setAllowlistModalOpen}
          provider={selectedProviderForModels}
          onUpdated={handleUpdatedFromAllowlist}
        />
      )}

      {/* Alert Chặn Xóa do Cascade */}
      {cascadeAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-900/60 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-zinc-100">
                  {t("ai.providers_manager.cannot_delete_title")}
                </h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {cascadeAlert.errorMessage}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setCascadeAlert(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs h-8"
              >
                {t("common.close")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Xóa Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-zinc-100">
                {t("ai.providers_manager.delete_confirm_title")}
                </h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {t("ai.providers_manager.delete_confirm_desc", {
                    name: deleteConfirm.provider.name,
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
                className="text-zinc-400 hover:text-zinc-200 text-xs h-8"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white text-xs h-8 font-medium"
              >
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

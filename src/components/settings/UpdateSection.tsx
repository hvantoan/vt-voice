import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { RefreshCw, Download, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { translateIpcError } from "@/lib/ipcErrorMapper";
import {
  UpdateInfo,
  UpdateProgressPayload,
  computeProgressPercent,
  formatBytes,
  normalizeVersionLabel,
} from "@/lib/updater";

interface UpdateSectionProps {
  autoCheckUpdates: boolean;
  setAutoCheckUpdates: (val: boolean) => void;
}

export const UpdateSection: React.FC<UpdateSectionProps> = ({
  autoCheckUpdates,
  setAutoCheckUpdates,
}) => {
  const { t } = useI18n();
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [checking, setChecking] = useState<boolean>(false);
  const [installing, setInstalling] = useState<boolean>(false);
  const [upToDateNotice, setUpToDateNotice] = useState<boolean>(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [progress, setProgress] = useState<UpdateProgressPayload | null>(null);

  useEffect(() => {
    let active = true;
    getVersion()
      .then((ver) => {
        if (active) setCurrentVersion(normalizeVersionLabel(ver));
      })
      .catch(() => {});

    invoke<UpdateInfo | null>("get_pending_update")
      .then((info) => {
        if (active && info?.available) {
          setPendingUpdate(info);
        }
      })
      .catch(() => {});

    const unlistenAvailPromise = listen<UpdateInfo>("updater:available", (ev) => {
      if (!active) return;
      if (ev.payload?.available) {
        setPendingUpdate(ev.payload);
        setDismissed(false);
        setUpToDateNotice(false);
      }
    });

    const unlistenProgressPromise = listen<UpdateProgressPayload>(
      "updater:progress",
      (ev) => {
        if (active) setProgress(ev.payload);
      },
    );

    return () => {
      active = false;
      unlistenAvailPromise.then((fn) => fn()).catch(() => {});
      unlistenProgressPromise.then((fn) => fn()).catch(() => {});
    };
  }, []);

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpToDateNotice(false);
    try {
      const info = await invoke<UpdateInfo>("check_for_updates");
      if (info.available) {
        setPendingUpdate(info);
        setDismissed(false);
      } else {
        setPendingUpdate(null);
        setUpToDateNotice(true);
      }
    } catch (err) {
      toast({
        title: t("common.error"),
        description: t("general.update_check_failed", {
          message: translateIpcError(err, t),
        }),
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    setInstalling(true);
    setProgress({ event: "Started", downloaded: 0, total: null });
    try {
      await invoke("install_update");
    } catch (err) {
      setInstalling(false);
      setProgress(null);
      toast({
        title: t("common.error"),
        description: t("general.update_install_failed", {
          message: translateIpcError(err, t),
        }),
        variant: "destructive",
      });
    }
  };

  const percent = progress
    ? computeProgressPercent(progress.downloaded, progress.total)
    : 0;

  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-zinc-200 leading-normal">
          {t("general.updates_title")}
        </h4>
        {currentVersion && (
          <span className="text-[11px] font-mono text-zinc-400">
            {t("general.current_version", { version: currentVersion })}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="w-4 h-4 text-zinc-400 shrink-0" />
          <div>
            <div className="text-xs text-zinc-200 font-medium leading-normal">
              {t("general.auto_check_updates_label")}
            </div>
            <div className="text-[11px] text-zinc-500 leading-normal">
              {t("general.auto_check_updates_desc")}
            </div>
          </div>
        </div>
        <Switch
          checked={autoCheckUpdates}
          onCheckedChange={setAutoCheckUpdates}
          className="data-[state=checked]:bg-emerald-600"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-800/60 pt-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400 leading-normal">
          {upToDateNotice && (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-400">{t("general.up_to_date")}</span>
            </>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={checking || installing}
          onClick={handleCheckUpdates}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
          <span>
            {checking
              ? t("general.checking_updates")
              : t("general.check_updates_btn")}
          </span>
        </Button>
      </div>

      {pendingUpdate?.available && pendingUpdate.version && !dismissed && (
        <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 leading-normal">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {t("general.update_available_title", {
                version: normalizeVersionLabel(pendingUpdate.version),
              })}
            </span>
          </div>

          <p className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
            {pendingUpdate.notes?.trim() || t("general.update_no_notes")}
          </p>

          {installing && progress && (
            <div className="space-y-1.5">
              <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>
                  {progress.event === "Finished"
                    ? t("general.installing_update")
                    : t("general.downloading_update")}
                </span>
                <span className="font-mono">
                  {progress.total
                    ? `${percent}% (${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)})`
                    : formatBytes(progress.downloaded)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {!installing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                {t("general.update_later_btn")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={installing}
              onClick={handleInstallUpdate}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t("general.update_now_btn")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

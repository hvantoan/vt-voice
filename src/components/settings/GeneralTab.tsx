import React from "react";
import { HotkeyRecorder, KeyBinding, DEFAULT_HOTKEY_BINDING, DEFAULT_TRANSLATE_BINDING, isSameBinding } from "./HotkeyRecorder";
import { Mic, Radio, Rocket, Monitor, Globe, Languages, AlertTriangle, RotateCcw, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { translateIpcError } from "@/lib/ipcErrorMapper";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, LocaleOption } from "@/lib/i18n";

interface GeneralTabProps {
  locale: LocaleOption;
  setLocale: (locale: LocaleOption) => void;
  hotkeyMode: "push_to_talk" | "toggle";
  setHotkeyMode: (mode: "push_to_talk" | "toggle") => void;
  hotkeyBinding: KeyBinding;
  setHotkeyBinding: (binding: KeyBinding) => void;
  translateBinding: KeyBinding;
  setTranslateBinding: (binding: KeyBinding) => void;
  autostart: boolean;
  setAutostart: (val: boolean) => void;
  startMinimized: boolean;
  setStartMinimized: (val: boolean) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  locale,
  setLocale,
  hotkeyMode,
  setHotkeyMode,
  hotkeyBinding,
  setHotkeyBinding,
  translateBinding,
  setTranslateBinding,
  autostart,
  setAutostart,
  startMinimized,
  setStartMinimized,
}) => {
  const { t } = useI18n();

  const isCollision = (
    hotkeyBinding.code === translateBinding.code &&
    !!hotkeyBinding.ctrl === !!translateBinding.ctrl &&
    !!hotkeyBinding.alt === !!translateBinding.alt &&
    !!hotkeyBinding.shift === !!translateBinding.shift &&
    !!hotkeyBinding.win === !!translateBinding.win
  );

  const isHotkeyDefault = isSameBinding(hotkeyBinding, DEFAULT_HOTKEY_BINDING);
  const isTranslateDefault = isSameBinding(translateBinding, DEFAULT_TRANSLATE_BINDING);
  const hasAnyCustom = !isHotkeyDefault || !isTranslateDefault;

  const handleResetAll = () => {
    setHotkeyBinding(DEFAULT_HOTKEY_BINDING);
    setTranslateBinding(DEFAULT_TRANSLATE_BINDING);
  };

  return (
    <div className="space-y-6">
      {/* Language Selector Card */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-zinc-200">
                {t("general.language_title")}
              </div>
              <div className="text-[11px] text-zinc-400 leading-normal">
                {t("general.language_desc")}
              </div>
            </div>
          </div>
          <div className="w-44">
            <Select
              value={locale}
              onValueChange={(val) => setLocale(val as LocaleOption)}
            >
              <SelectTrigger className="h-8 bg-zinc-900 border-zinc-700 text-xs text-zinc-200 focus:ring-emerald-500/50">
                <SelectValue placeholder={t("general.languages.system")} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-xs text-zinc-200">
                <SelectItem value="system">
                  {t("general.languages.system")}
                </SelectItem>
                <SelectItem value="vi">
                  {t("general.languages.vi")}
                </SelectItem>
                <SelectItem value="en">
                  {t("general.languages.en")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Hotkey Mode */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">
          {t("general.hotkey_mode_title")}
        </h3>
        <p className="text-xs text-zinc-400 mb-3 leading-normal">
          {t("general.hotkey_mode_desc")}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Card
            onClick={() => setHotkeyMode("push_to_talk")}
            className={`cursor-pointer transition-all border rounded-lg ${
              hotkeyMode === "push_to_talk"
                ? "bg-zinc-900 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-card border-border hover:border-zinc-700"
            }`}
          >
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Mic
                  className={`w-4 h-4 ${hotkeyMode === "push_to_talk" ? "text-emerald-400" : "text-zinc-400"}`}
                />
                <span className="text-xs font-semibold text-zinc-200">
                  {t("general.modes.push_to_talk")}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                {t("general.modes.push_to_talk_desc")}
              </p>
            </CardContent>
          </Card>

          <Card
            onClick={() => setHotkeyMode("toggle")}
            className={`cursor-pointer transition-all border rounded-lg ${
              hotkeyMode === "toggle"
                ? "bg-zinc-900 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-card border-border hover:border-zinc-700"
            }`}
          >
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Radio
                  className={`w-4 h-4 ${hotkeyMode === "toggle" ? "text-emerald-400" : "text-zinc-400"}`}
                />
                <span className="text-xs font-semibold text-zinc-200">
                  {t("general.modes.toggle")}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                {t("general.modes.toggle_desc")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Shortcuts Table */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3.5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-0.5">
              {t("general.shortcuts_title")}
            </h3>
            <p className="text-xs text-zinc-400 leading-normal">
              {t("general.shortcuts_desc")}
            </p>
          </div>

          {hasAnyCustom && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-md border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer active:scale-95 shrink-0"
              title={t("general.reset_all_defaults")}
            >
              <RotateCcw className="w-3 h-3 text-zinc-400" />
              <span>{t("general.reset_all_defaults")}</span>
            </button>
          )}
        </div>

        {isCollision && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{t("general.hotkey_collision_error")}</span>
          </div>
        )}

        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/40 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/60 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                <th className="py-2.5 px-3.5 font-medium">{t("general.shortcuts_table_feature")}</th>
                <th className="py-2.5 px-3.5 w-[200px] font-medium">{t("general.shortcuts_table_hotkey")}</th>
                <th className="py-2.5 px-3.5 w-[90px] text-right font-medium">{t("general.shortcuts_table_action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {/* Row 1: Voice Typing */}
              <tr
                className={cn(
                  "group transition-colors hover:bg-zinc-900/40",
                  isCollision && "bg-rose-950/10"
                )}
              >
                <td className="py-3 px-3.5 align-middle">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-200">
                        {t("general.hotkey_binding_title")}
                       </div>
                      <div className="text-[11px] text-zinc-400 leading-normal line-clamp-1">
                        {t("general.hotkey_binding_desc")}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3.5 align-middle">
                  <HotkeyRecorder
                    value={hotkeyBinding}
                    onChange={setHotkeyBinding}
                    hasError={isCollision}
                    allowSingleModifier={true}
                  />
                </td>
                <td className="py-3 px-3.5 align-middle text-right">
                  <button
                    type="button"
                    onClick={() => setHotkeyBinding(DEFAULT_HOTKEY_BINDING)}
                    disabled={isHotkeyDefault}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border transition-all",
                      isHotkeyDefault
                        ? "opacity-25 border-transparent text-zinc-500 cursor-not-allowed"
                        : "border-zinc-700/60 bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 active:scale-95 cursor-pointer"
                    )}
                    title={t("general.reset_default_tooltip", { default: "Right Alt" })}
                  >
                    <RotateCcw className="w-3 h-3 text-zinc-400" />
                    <span>{t("general.reset_default")}</span>
                  </button>
                </td>
              </tr>

              {/* Row 2: Selection Translation */}
              <tr
                className={cn(
                  "group transition-colors hover:bg-zinc-900/40",
                  isCollision && "bg-rose-950/10"
                )}
              >
                <td className="py-3 px-3.5 align-middle">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Languages className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-200">
                        {t("general.translate_hotkey_title")}
                      </div>
                      <div className="text-[11px] text-zinc-400 leading-normal line-clamp-1">
                        {t("general.translate_hotkey_desc")}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3.5 align-middle">
                  <HotkeyRecorder
                    value={translateBinding}
                    onChange={setTranslateBinding}
                    hasError={isCollision}
                    allowSingleModifier={false}
                  />
                </td>
                <td className="py-3 px-3.5 align-middle text-right">
                  <button
                    type="button"
                    onClick={() => setTranslateBinding(DEFAULT_TRANSLATE_BINDING)}
                    disabled={isTranslateDefault}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border transition-all",
                      isTranslateDefault
                        ? "opacity-25 border-transparent text-zinc-500 cursor-not-allowed"
                        : "border-zinc-700/60 bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 active:scale-95 cursor-pointer"
                    )}
                    title={t("general.reset_default_tooltip", { default: "Alt + T" })}
                  >
                    <RotateCcw className="w-3 h-3 text-zinc-400" />
                    <span>{t("general.reset_default")}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Startup Settings */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
        <h4 className="text-xs font-semibold text-zinc-200 mb-2">
          {t("general.startup_title")}
        </h4>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Rocket className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-xs text-zinc-200 font-medium">
                {t("general.autostart_label")}
              </div>
              <div className="text-[11px] text-zinc-500 leading-normal">
                {t("general.autostart_desc")}
              </div>
            </div>
          </div>
          <Switch
            checked={autostart}
            onCheckedChange={setAutostart}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-xs text-zinc-200 font-medium">
                {t("general.start_minimized_label")}
              </div>
              <div className="text-[11px] text-zinc-500 leading-normal">
                {t("general.start_minimized_desc")}
              </div>
            </div>
          </div>
          <Switch
            checked={startMinimized}
            onCheckedChange={setStartMinimized}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>
      </div>

      {/* Logs & Diagnostics */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-4">
        <h4 className="text-xs font-semibold text-zinc-200 mb-2">
          {t("general.logs_title")}
        </h4>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="text-xs text-zinc-200 font-medium">
                {t("general.logs_folder_label")}
              </div>
              <div className="text-[11px] text-zinc-500 leading-normal">
                {t("general.logs_desc")}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await invoke("open_logs_dir");
                toast({ title: t("general.logs_folder_opened") });
              } catch (err) {
                toast({
                  title: t("common.error"),
                  description: translateIpcError(err, t),
                  variant: "destructive",
                });
              }
            }}
          >
            {t("general.open_logs_folder")}
          </Button>
        </div>
      </div>
    </div>
  );
};

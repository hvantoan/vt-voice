import React from "react";
import { HotkeyRecorder, KeyBinding } from "./HotkeyRecorder";
import { Mic, Radio, Rocket, Monitor, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  autostart,
  setAutostart,
  startMinimized,
  setStartMinimized,
}) => {
  const { t } = useI18n();

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
              <div className="text-[11px] text-zinc-400">
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
        <p className="text-xs text-zinc-400 mb-3">
          {t("general.hotkey_mode_desc")}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Card
            onClick={() => setHotkeyMode("push_to_talk")}
            className={`cursor-pointer transition-all border ${
              hotkeyMode === "push_to_talk"
                ? "bg-zinc-900 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
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
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {t("general.modes.push_to_talk_desc")}
              </p>
            </CardContent>
          </Card>

          <Card
            onClick={() => setHotkeyMode("toggle")}
            className={`cursor-pointer transition-all border ${
              hotkeyMode === "toggle"
                ? "bg-zinc-900 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
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
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {t("general.modes.toggle_desc")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hotkey Binding */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
        <div>
          <div className="text-xs font-semibold text-zinc-200">
            {t("general.hotkey_binding_title")}
          </div>
          <div className="text-[11px] text-zinc-400">
            {t("general.hotkey_binding_desc")}
          </div>
        </div>
        <HotkeyRecorder value={hotkeyBinding} onChange={setHotkeyBinding} />
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
              <div className="text-[11px] text-zinc-500">
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
              <div className="text-[11px] text-zinc-500">
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
    </div>
  );
};

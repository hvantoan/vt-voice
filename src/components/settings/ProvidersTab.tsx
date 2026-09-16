import React from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ProviderConfig } from "./providers/ProviderDialog";
import { ProviderManager } from "./providers/ProviderManager";

export interface ProvidersTabProps {
  providers: ProviderConfig[];
  onProvidersChanged: (providers: ProviderConfig[]) => void;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  onProvidersChanged,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 pb-8">
      {/* Phân hệ quản lý nhà cung cấp AI */}
      <section className="space-y-3">
        <ProviderManager
          providers={providers}
          onProvidersChanged={onProvidersChanged}
        />
      </section>

      {/* Thông tin bảo mật Windows Credential Vault */}
      <section className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-zinc-200">
            {t("ai.vault_badge")}
          </h4>
          <p className="text-[11px] text-zinc-400 leading-normal py-0.5">
            {t("ai.api_key_desc")}
          </p>
        </div>
      </section>
    </div>
  );
};

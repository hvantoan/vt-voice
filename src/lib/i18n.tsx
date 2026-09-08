import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import vi from "../locales/vi.json";
import en from "../locales/en.json";

export type SupportedLocale = "vi" | "en";
export type LocaleOption = "system" | "vi" | "en";

export type Dictionary = typeof vi;

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<Dictionary>;

export const DICTIONARIES: Record<SupportedLocale, Dictionary> = {
  vi,
  en,
};

/**
 * Resolves browser / OS language to a supported locale.
 * - "vi*" (e.g. "vi-VN", "vi") -> "vi"
 * - any other specified string -> "en"
 * - undefined or empty -> "vi" default fallback
 */
export function resolveSystemLanguage(lang?: string): SupportedLocale {
  if (!lang || lang.trim() === "") {
    return "vi";
  }
  const clean = lang.toLowerCase().replace("_", "-");
  if (clean.startsWith("vi")) {
    return "vi";
  }
  return "en";
}

/**
 * Replaces `{var}` placeholders in template with provided parameters.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (key in params) {
      return String(params[key]);
    }
    return match;
  });
}

function getTranslationValue(dict: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

interface I18nContextType {
  locale: SupportedLocale;
  settingLocale: LocaleOption;
  setLocale: (option: LocaleOption) => void;
  t: (key: TranslationKey | (string & {}), params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: LocaleOption;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLocale = "system",
}) => {
  const [settingLocale, setSettingLocale] = useState<LocaleOption>(initialLocale);

  const effectiveLocale: SupportedLocale = useMemo(() => {
    if (settingLocale === "system") {
      const navLang = typeof navigator !== "undefined" ? navigator.language : undefined;
      return resolveSystemLanguage(navLang);
    }
    return settingLocale;
  }, [settingLocale]);

  // Sync if initialLocale prop changes externally (e.g. config load)
  useEffect(() => {
    setSettingLocale(initialLocale);
  }, [initialLocale]);
  // Sync tray locale whenever effectiveLocale updates
  useEffect(() => {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      invoke("update_tray_locale_cmd", { locale: effectiveLocale }).catch(() => {});
    }
  }, [effectiveLocale]);

  // Listen for cross-window locale changes
  useEffect(() => {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      const unlistenPromise = listen<LocaleOption>("locale-changed", (event) => {
        if (event.payload) {
          setSettingLocale(event.payload);
        }
      });
      return () => {
        unlistenPromise.then((f) => f()).catch(() => {});
      };
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey | (string & {}), params?: Record<string, string | number>): string => {
      const activeDict = DICTIONARIES[effectiveLocale] as unknown as Record<string, unknown>;
      const rawVal = getTranslationValue(activeDict, key);

      if (rawVal !== undefined) {
        return interpolate(rawVal, params);
      }

      // Fallback to Vietnamese if missing in English
      if (effectiveLocale !== "vi") {
        const viDict = DICTIONARIES.vi as unknown as Record<string, unknown>;
        const viVal = getTranslationValue(viDict, key);
        if (viVal !== undefined) {
          return interpolate(viVal, params);
        }
      }

      // Return raw key if not found
      return key;
    },
    [effectiveLocale],
  );

  const contextValue = useMemo<I18nContextType>(
    () => ({
      locale: effectiveLocale,
      settingLocale,
      setLocale: setSettingLocale,
      t,
    }),
    [effectiveLocale, settingLocale, t],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

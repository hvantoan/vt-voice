import type { TranslationKey } from "./i18n";

export const KNOWN_IPC_ERRORS: Record<string, TranslationKey> = {
  "API key cannot be empty": "errors.api_key_empty",
  "Cannot save a masked API key": "errors.api_key_masked",
  "Missing required parameter `key` or `apiKey`": "errors.missing_param_key",
  "Could not determine config directory": "errors.no_config_dir",
  "Cửa sổ Admin: Nhấn Ctrl+V để dán": "errors.admin_window_paste",
  "admin_window_paste": "errors.admin_window_paste",
};

export type TranslateFn = (
  key: TranslationKey | (string & {}),
  params?: Record<string, string | number>,
) => string;

/**
 * Translates raw IPC errors originating from the Rust daemon into localized user-facing strings.
 * Falls back to the original error message if no translation key is registered.
 */
export function translateIpcError(
  rawError: unknown,
  t: TranslateFn,
): string {
  if (typeof rawError !== "string") {
    if (
      rawError &&
      typeof rawError === "object" &&
      "message" in rawError &&
      typeof (rawError as { message: unknown }).message === "string"
    ) {
      return translateIpcError((rawError as { message: string }).message, t);
    }
    return String(rawError ?? "");
  }

  const trimmed = rawError.trim();
  if (!trimmed) {
    return rawError;
  }

  const mappedKey = KNOWN_IPC_ERRORS[trimmed];
  if (mappedKey) {
    return t(mappedKey);
  }


  // Specific daemon messages: Admin window paste notice
  if (trimmed === "Cửa sổ Admin: Nhấn Ctrl+V để dán" || trimmed === "admin_window_paste") {
    return t("errors.admin_window_paste");
  }

  // Recording error
  if (trimmed.startsWith("Lỗi thu âm: ") || trimmed.startsWith("recording_error: ")) {
    const detail = trimmed.replace(/^(?:Lỗi thu âm|recording_error):\s*/, "");
    return t("errors.recording_error", { error: detail });
  }
  if (trimmed === "Lỗi thu âm" || trimmed === "recording_error") {
    return t("errors.recording_error", { error: "" }).replace(/:\s*$/, "");
  }

  // Paste error
  if (trimmed.startsWith("Lỗi dán: ") || trimmed.startsWith("paste_error: ")) {
    const detail = trimmed.replace(/^(?:Lỗi dán|paste_error):\s*/, "");
    return t("errors.paste_error", { error: detail });
  }
  if (trimmed === "Lỗi dán" || trimmed === "paste_error") {
    return t("errors.paste_error", { error: "" }).replace(/:\s*$/, "");
  }

  // API key missing for specific provider
  const apiKeyMatch = trimmed.match(/^(?:Chưa cài đặt API key cho|api_key_missing:?)\s*(.+)$/);
  if (apiKeyMatch) {
    return t("errors.api_key_missing_provider", { provider: apiKeyMatch[1].trim() });
  }

  // Provider error: Lỗi {provider}: {err}
  const providerMatch = trimmed.match(/^Lỗi\s+([^:]+):\s*(.+)$/);
  if (providerMatch) {
    return t("errors.provider_error", {
      provider: providerMatch[1].trim(),
      error: providerMatch[2].trim(),
    });
  }
  return rawError;
}

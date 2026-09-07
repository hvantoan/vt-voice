import type { TranslationKey } from "./i18n";

export const KNOWN_IPC_ERRORS: Record<string, TranslationKey> = {
  "API key cannot be empty": "errors.api_key_empty",
  "Cannot save a masked API key": "errors.api_key_masked",
  "Missing required parameter `key` or `apiKey`": "errors.missing_param_key",
  "Could not determine config directory": "errors.no_config_dir",
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

  return rawError;
}

import { describe, expect, test } from "bun:test";
import { translateIpcError, KNOWN_IPC_ERRORS } from "../src/lib/ipcErrorMapper";
import vi from "../src/locales/vi.json";
import en from "../src/locales/en.json";

describe("IPC Error Translation Bridge - Phase 2 (TDD)", () => {
  const mockTranslateVi = (key: string, params?: Record<string, string | number>) => {
    const parts = key.split(".");
    let curr: unknown = vi;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    let res = typeof curr === "string" ? curr : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        res = res.replaceAll(`{${k}}`, String(v));
      }
    }
    return res;
  };

  const mockTranslateEn = (key: string, params?: Record<string, string | number>) => {
    const parts = key.split(".");
    let curr: unknown = en;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    let res = typeof curr === "string" ? curr : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        res = res.replaceAll(`{${k}}`, String(v));
      }
    }
    return res;
  };

  test("translates 'API key cannot be empty' correctly", () => {
    const raw = "API key cannot be empty";
    expect(translateIpcError(raw, mockTranslateVi)).toBe(vi.errors.api_key_empty);
    expect(translateIpcError(raw, mockTranslateEn)).toBe(en.errors.api_key_empty);
  });

  test("translates 'Cannot save a masked API key' correctly", () => {
    const raw = "Cannot save a masked API key";
    expect(translateIpcError(raw, mockTranslateVi)).toBe(vi.errors.api_key_masked);
    expect(translateIpcError(raw, mockTranslateEn)).toBe(en.errors.api_key_masked);
  });

  test("translates 'Missing required parameter `key` or `apiKey`' correctly", () => {
    const raw = "Missing required parameter `key` or `apiKey`";
    expect(translateIpcError(raw, mockTranslateVi)).toBe(vi.errors.missing_param_key);
    expect(translateIpcError(raw, mockTranslateEn)).toBe(en.errors.missing_param_key);
  });

  test("translates 'Could not determine config directory' correctly", () => {
    const raw = "Could not determine config directory";
    expect(translateIpcError(raw, mockTranslateVi)).toBe(vi.errors.no_config_dir);
    expect(translateIpcError(raw, mockTranslateEn)).toBe(en.errors.no_config_dir);
  });

  test("returns original error string when error is unmapped", () => {
    const unmapped = "Network socket timeout after 5000ms";
    expect(translateIpcError(unmapped, mockTranslateVi)).toBe(unmapped);
    expect(translateIpcError(unmapped, mockTranslateEn)).toBe(unmapped);
  });

  test("handles empty or whitespace-only error gracefully", () => {
    expect(translateIpcError("", mockTranslateVi)).toBe("");
    expect(translateIpcError("   ", mockTranslateVi)).toBe("   ");
  });

  test("all KNOWN_IPC_ERRORS point to valid keys in both vi and en", () => {
    for (const [rawErr, key] of Object.entries(KNOWN_IPC_ERRORS)) {
      expect(mockTranslateVi(key)).not.toBe(key);
      expect(mockTranslateEn(key)).not.toBe(key);
    }
  });

  test("translates daemon admin window paste message correctly", () => {
    const raw = "Cửa sổ Admin: Nhấn Ctrl+V để dán";
    expect(translateIpcError(raw, mockTranslateVi)).toBe(vi.errors.admin_window_paste);
    expect(translateIpcError(raw, mockTranslateEn)).toBe(en.errors.admin_window_paste);
  });

  test("translates daemon recording error with dynamic detail", () => {
    const raw = "Lỗi thu âm: WASAPI initialization failed";
    expect(translateIpcError(raw, mockTranslateVi)).toBe("Lỗi thu âm: WASAPI initialization failed");
    expect(translateIpcError(raw, mockTranslateEn)).toBe("Recording error: WASAPI initialization failed");
  });

  test("translates daemon unconfigured provider API key error", () => {
    const raw = "Chưa cài đặt API key cho Groq";
    expect(translateIpcError(raw, mockTranslateVi)).toBe("Chưa cài đặt API key cho Groq");
    expect(translateIpcError(raw, mockTranslateEn)).toBe("API key not configured for Groq");
  });

  test("translates daemon provider error correctly", () => {
    const raw = "Lỗi OpenRouter: 401 Unauthorized";
    expect(translateIpcError(raw, mockTranslateVi)).toBe("Lỗi OpenRouter: 401 Unauthorized");
    expect(translateIpcError(raw, mockTranslateEn)).toBe("OpenRouter error: 401 Unauthorized");
  });

  test("translates daemon paste error with dynamic detail", () => {
    const raw = "Lỗi dán: Clipboard locked by another process";
    expect(translateIpcError(raw, mockTranslateVi)).toBe("Lỗi dán: Clipboard locked by another process");
    expect(translateIpcError(raw, mockTranslateEn)).toBe("Paste error: Clipboard locked by another process");
  });

  test("translates unconfigured provider key for provider correctly", () => {
    const raw = "Chưa cấu hình API key cho provider này";
    expect(translateIpcError(raw, mockTranslateVi)).toBe(vi.errors.api_key_not_configured);
    expect(translateIpcError(raw, mockTranslateEn)).toBe(en.errors.api_key_not_configured);
  });
});

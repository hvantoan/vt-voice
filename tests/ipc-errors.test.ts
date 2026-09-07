import { describe, expect, test } from "bun:test";
import { translateIpcError, KNOWN_IPC_ERRORS } from "../src/lib/ipcErrorMapper";
import vi from "../src/locales/vi.json";
import en from "../src/locales/en.json";

describe("IPC Error Translation Bridge - Phase 2 (TDD)", () => {
  const mockTranslateVi = (key: string) => {
    const parts = key.split(".");
    let curr: unknown = vi;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    return typeof curr === "string" ? curr : key;
  };

  const mockTranslateEn = (key: string) => {
    const parts = key.split(".");
    let curr: unknown = en;
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    return typeof curr === "string" ? curr : key;
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
});

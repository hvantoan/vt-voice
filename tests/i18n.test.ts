import { describe, expect, test } from "bun:test";
import { resolveSystemLanguage, interpolate } from "../src/lib/i18n";
import vi from "../src/locales/vi.json";
import en from "../src/locales/en.json";

function getLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

describe("i18n Architecture - Phase 1 Foundation", () => {
  describe("Dictionary Parity & Completeness", () => {
    test("vi.json and en.json have identical key schemas", () => {
      const viKeys = getLeafKeys(vi as Record<string, unknown>);
      const enKeys = getLeafKeys(en as Record<string, unknown>);

      const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
      const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

      expect(missingInEn).toEqual([]);
      expect(missingInVi).toEqual([]);
      expect(viKeys.length).toBeGreaterThan(50);
    });

    test("Required top-level namespaces exist in both dictionaries", () => {
      const requiredNamespaces = [
        "common",
        "settings",
        "general",
        "audio",
        "ai",
        "history",
        "hotkey",
        "overlay",
        "tray",
        "errors",
      ];

      for (const ns of requiredNamespaces) {
        expect(vi).toHaveProperty(ns);
        expect(en).toHaveProperty(ns);
      }
    });

    test("All dictionary values are non-empty strings", () => {
      const viObj = vi as Record<string, unknown>;
      const enObj = en as Record<string, unknown>;
      const viKeys = getLeafKeys(viObj);

      for (const key of viKeys) {
        const viVal = getValueByPath(viObj, key);
        const enVal = getValueByPath(enObj, key);
        expect(typeof viVal).toBe("string");
        expect(typeof enVal).toBe("string");
        expect((viVal as string).trim().length).toBeGreaterThan(0);
        expect((enVal as string).trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe("Language Detection & Fallback", () => {
    test("resolveSystemLanguage maps Vietnamese locales to vi", () => {
      expect(resolveSystemLanguage("vi-VN")).toBe("vi");
      expect(resolveSystemLanguage("vi")).toBe("vi");
      expect(resolveSystemLanguage("vi_VN")).toBe("vi");
    });

    test("resolveSystemLanguage maps English locales to en", () => {
      expect(resolveSystemLanguage("en-US")).toBe("en");
      expect(resolveSystemLanguage("en-GB")).toBe("en");
      expect(resolveSystemLanguage("en")).toBe("en");
    });

    test("resolveSystemLanguage falls back other non-vi locales to en", () => {
      expect(resolveSystemLanguage("fr-FR")).toBe("en");
      expect(resolveSystemLanguage("ja-JP")).toBe("en");
      expect(resolveSystemLanguage("de")).toBe("en");
    });

    test("resolveSystemLanguage defaults to vi when undefined or empty", () => {
      expect(resolveSystemLanguage(undefined)).toBe("vi");
      expect(resolveSystemLanguage("")).toBe("vi");
    });
  });

  describe("String Interpolation & Fallback", () => {
    test("interpolate replaces template variables correctly", () => {
      const template = "Thiết bị không tìm thấy: {device}";
      const result = interpolate(template, { device: "Mic 1" });
      expect(result).toBe("Thiết bị không tìm thấy: Mic 1");
    });

    test("interpolate leaves string intact if no params provided", () => {
      const template = "Đang sẵn sàng";
      const result = interpolate(template);
      expect(result).toBe("Đang sẵn sàng");
    });

    test("interpolate replaces multiple params", () => {
      const template = "{count} mục trong {total}";
      const result = interpolate(template, { count: "5", total: "10" });
      expect(result).toBe("5 mục trong 10");
    });
  });
});

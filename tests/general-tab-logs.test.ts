import { describe, expect, test } from "bun:test";
import vi from "../src/locales/vi.json";
import en from "../src/locales/en.json";

const LOG_KEYS = [
  "general.logs_title",
  "general.logs_desc",
  "general.logs_folder_label",
  "general.open_logs_folder",
  "general.logs_folder_opened",
] as const;

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;
  for (const part of path.split(".")) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

describe("GeneralTab - Logs & Diagnostics", () => {
  test("every log key exists and is non-empty in both locales", () => {
    for (const key of LOG_KEYS) {
      const viVal = getValueByPath(vi as Record<string, unknown>, key);
      const enVal = getValueByPath(en as Record<string, unknown>, key);
      expect(typeof viVal, `vi missing ${key}`).toBe("string");
      expect(typeof enVal, `en missing ${key}`).toBe("string");
      expect((viVal as string).length).toBeGreaterThan(0);
      expect((enVal as string).length).toBeGreaterThan(0);
    }
  });

  test("Vietnamese log keys use diacritics", () => {
    const title = getValueByPath(vi as Record<string, unknown>, "general.logs_title") as string;
    // "Nhật ký & Chẩn đoán" — assert real Vietnamese diacritics, not ASCII fallback
    expect(title).toContain("ậ");
    expect(title).toContain("đ");
  });
});

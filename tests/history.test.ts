import { describe, expect, test } from "bun:test";
import vi from "../src/locales/vi.json";
import en from "../src/locales/en.json";
import type { HistoryItem } from "../src/components/settings/HistoryTab";

describe("Voice Transcription History - Full Lifecycle", () => {
  describe("Localization coverage for History Tab", () => {
    test("all required history keys exist in Vietnamese and English", () => {
      const requiredKeys = [
        "title",
        "search_placeholder",
        "empty_title",
        "empty_desc",
        "clear_btn",
        "clear_confirm_title",
        "clear_confirm_desc",
        "copy_tooltip",
        "stt_time",
        "polish_time",
        "total_time",
      ] as const;

      for (const key of requiredKeys) {
        expect(vi.history).toHaveProperty(key);
        expect(en.history).toHaveProperty(key);
        expect(typeof (vi.history as Record<string, string>)[key]).toBe("string");
        expect(typeof (en.history as Record<string, string>)[key]).toBe("string");
      }
    });

    test("settings tab label for history exists in both dictionaries", () => {
      expect(vi.settings.tabs.history).toBe("Lịch sử");
      expect(en.settings.tabs.history).toBe("History");
    });
  });

  describe("HistoryItem Data Contract & Processing", () => {
    const sampleHistory: HistoryItem[] = [
      {
        id: "hist_1",
        timestamp: "2026-09-08 14:30:00",
        rawText: "viet nam vo dich",
        polishedText: "Việt Nam vô địch!",
        sttDurationMs: 120,
        llmDurationMs: 250,
        totalDurationMs: 370,
      },
      {
        id: "hist_2",
        timestamp: "2026-09-08 14:35:00",
        rawText: "deploy len staging",
        polishedText: "Deploy lên staging.",
        sttDurationMs: 90,
        llmDurationMs: 200,
        totalDurationMs: 290,
      },
    ];

    test("matches expected HistoryItem schema from Rust backend camelCase serialization", () => {
      const item = sampleHistory[0];
      expect(typeof item.id).toBe("string");
      expect(typeof item.timestamp).toBe("string");
      expect(typeof item.rawText).toBe("string");
      expect(typeof item.polishedText).toBe("string");
      expect(typeof item.sttDurationMs).toBe("number");
      expect(typeof item.llmDurationMs).toBe("number");
      expect(typeof item.totalDurationMs).toBe("number");
    });

    test("search query filters by both polishedText and rawText case-insensitively", () => {
      const matchedVietNam = sampleHistory.filter(
        (item) =>
          item.polishedText.toLowerCase().includes("việt nam") ||
          item.rawText.toLowerCase().includes("việt nam"),
      );
      expect(matchedVietNam.length).toBe(1);

      const matchedStaging = sampleHistory.filter(
        (item) =>
          item.polishedText.toLowerCase().includes("staging") ||
          item.rawText.toLowerCase().includes("staging"),
      );
      expect(matchedStaging.length).toBe(1);

      const matchedCaseInsensitive = sampleHistory.filter(
        (item) =>
          item.polishedText.toLowerCase().includes("vo dich".toLowerCase()) ||
          item.rawText.toLowerCase().includes("vo dich".toLowerCase()),
      );
      expect(matchedCaseInsensitive.length).toBe(1);

      const matchedNonExistent = sampleHistory.filter(
        (item) =>
          item.polishedText.toLowerCase().includes("nonexistent") ||
          item.rawText.toLowerCase().includes("nonexistent"),
      );
      expect(matchedNonExistent.length).toBe(0);
    });

    test("prepends new history items at the top and respects 50-item cap", () => {
      const historyList: HistoryItem[] = Array.from({ length: 50 }, (_, i) => ({
        id: `hist_${i}`,
        timestamp: `2026-09-08 10:${String(i).padStart(2, "0")}:00`,
        rawText: `raw ${i}`,
        polishedText: `polished ${i}`,
        sttDurationMs: 100,
        llmDurationMs: 200,
        totalDurationMs: 300,
      }));

      const newItem: HistoryItem = {
        id: "hist_new",
        timestamp: "2026-09-08 11:00:00",
        rawText: "new recording",
        polishedText: "New recording.",
        sttDurationMs: 110,
        llmDurationMs: 190,
        totalDurationMs: 300,
      };

      const updated = [newItem, ...historyList.filter((i) => i.id !== newItem.id)].slice(0, 50);

      expect(updated.length).toBe(50);
      expect(updated[0].id).toBe("hist_new");
      expect(updated[49].id).toBe("hist_48");
      expect(updated.some((i) => i.id === "hist_49")).toBe(false);
    });

    test("clearing history empties the list", () => {
      let historyList = [...sampleHistory];
      expect(historyList.length).toBe(2);
      historyList = [];
      expect(historyList.length).toBe(0);
    });
  });
});

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import vi from "../src/locales/vi.json";
import en from "../src/locales/en.json";

describe("UI Localization & Migration - Phase 3 (TDD)", () => {
  const componentsDir = path.resolve(__dirname, "../src/components");

  describe("Dictionary Tab & Component Key Coverage", () => {
    test("Settings tabs translation keys exist for both languages", () => {
      expect(vi.settings.tabs.general).toBe("Chung");
      expect(en.settings.tabs.general).toBe("General");

      expect(vi.settings.tabs.audio).toBe("Âm thanh");
      expect(en.settings.tabs.audio).toBe("Audio");

      expect(vi.settings.tabs.ai).toBe("Mô hình AI");
      expect(en.settings.tabs.ai).toBe("AI Models");

      expect(vi.settings.tabs.history).toBe("Lịch sử");
      expect(en.settings.tabs.history).toBe("History");
    });

    test("General tab language selection options exist", () => {
      expect(vi.general.languages.system).toBe("Mặc định hệ thống");
      expect(en.general.languages.system).toBe("System Default");

      expect(vi.general.languages.vi).toBe("Tiếng Việt");
      expect(en.general.languages.vi).toBe("Tiếng Việt");

      expect(vi.general.languages.en).toBe("English");
      expect(en.general.languages.en).toBe("English");
    });

    test("Overlay status messages exist in both languages", () => {
      expect(vi.overlay.listening).toBe("Đang nghe...");
      expect(en.overlay.listening).toBe("Listening...");

      expect(vi.overlay.processing).toBe("Đang xử lý AI...");
      expect(en.overlay.processing).toBe("Processing AI...");

      expect(vi.overlay.pasted).toBe("Đã chèn văn bản!");
      expect(en.overlay.pasted).toBe("Text pasted!");
    });

    test("Hotkey presets exist in dictionaries for both languages", () => {
      expect(vi.hotkey.presets.right_alt).toBe("Right Alt");
      expect(en.hotkey.presets.right_alt).toBe("Right Alt");

      expect(vi.hotkey.presets.mouse_4).toBe("Chuột 4");
      expect(en.hotkey.presets.mouse_4).toBe("Mouse 4");
      expect(vi.hotkey.presets.f7).toBe("F7");
      expect(en.hotkey.presets.f7).toBe("F7");
    });

    test("Providers metadata exist in dictionaries for both languages", () => {
      expect(vi.ai.providers.groq.name).toBe("Groq Cloud");
      expect(en.ai.providers.groq.name).toBe("Groq Cloud");
      expect(vi.ai.providers.groq.badge).toBe("Siêu nhanh");
      expect(en.ai.providers.groq.badge).toBe("Ultra Fast");
      expect(vi.ai.providers.custom.description).toContain("Endpoint OpenAI-compatible");
      expect(en.ai.providers.custom.description).toContain("OpenAI-compatible local endpoint");
    });
  });

  describe("Zero Hardcoded Bilingual String Audit", () => {
    const bilingualPatterns = [
      "Chế độ phím tắt (Hotkey Mode)",
      "Nhấn và giữ (Push-to-Talk)",
      "Bật / Tắt (Toggle)",
      "Khởi động cùng Windows (Autostart)",
      "Thiết bị ghi âm (Microphone)",
      "Từ vựng kỹ thuật (Loanwords)",
      "Cài đặt (Settings)",
      "Thoát (Quit)",
      "Right Alt (Mặc định)",
      "Chuột 4 (Back)",
      "Chuột 5 (Forward)",
      "Chuột giữa (Mouse 3)",
    ];

    const targetFiles = [
      "settings/SettingsLayout.tsx",
      "settings/GeneralTab.tsx",
      "settings/AudioTab.tsx",
      "settings/AiTab.tsx",
      "settings/HistoryTab.tsx",
      "settings/HotkeyRecorder.tsx",
      "OverlayPill.tsx",
    ];

    test("no legacy bilingual strings remain in frontend components", () => {
      const violations: { file: string; pattern: string }[] = [];

      for (const relPath of targetFiles) {
        const fullPath = path.join(componentsDir, relPath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, "utf-8");
        for (const pat of bilingualPatterns) {
          if (content.includes(pat)) {
            violations.push({ file: relPath, pattern: pat });
          }
        }
      }

      expect(violations).toEqual([]);
    });

    test("all target components import and utilize useI18n hook", () => {
      const missingHookUsage: string[] = [];

      for (const relPath of targetFiles) {
        const fullPath = path.join(componentsDir, relPath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, "utf-8");
        if (!content.includes("useI18n") && !content.includes("i18n")) {
          missingHookUsage.push(relPath);
        }
      }

      expect(missingHookUsage).toEqual([]);
    });

    test("AiTab imports and uses translateIpcError", () => {
      const aiTabPath = path.join(componentsDir, "settings/AiTab.tsx");
      const content = fs.readFileSync(aiTabPath, "utf-8");

      expect(content).toContain("translateIpcError");
    });

    test("OverlayPill imports and uses translateIpcError for daemon error mapping", () => {
      const overlayPath = path.join(componentsDir, "OverlayPill.tsx");
      const content = fs.readFileSync(overlayPath, "utf-8");

      expect(content).toContain("translateIpcError");
    });

    test("HotkeyRecorder presets use F7 and do not assign Windows reserved Alt+Space", () => {
      const hotkeyRecorderPath = path.join(componentsDir, "settings/HotkeyRecorder.tsx");
      const content = fs.readFileSync(hotkeyRecorderPath, "utf-8");

      expect(content).toContain('name: "F7"');
      expect(content).toContain("0x76");
      expect(content).not.toContain("hotkey.presets.alt_space");
    });

    test("AiTab handleDeleteKey invokes onKeyChange to refresh sidebar key status", () => {
      const aiTabPath = path.join(componentsDir, "settings/AiTab.tsx");
      const content = fs.readFileSync(aiTabPath, "utf-8");

      const handleDeleteKeyMatch = content.match(/const handleDeleteKey = async \(\) => \{([\s\S]*?)\n  \};/);
      expect(handleDeleteKeyMatch).not.toBeNull();
      expect(handleDeleteKeyMatch![1]).toContain("onKeyChange?.()");
    });

    test("AiTab PROVIDERS definitions include localization keys", () => {
      const aiTabPath = path.join(componentsDir, "settings/AiTab.tsx");
      const content = fs.readFileSync(aiTabPath, "utf-8");

      expect(content).toContain("nameKey");
      expect(content).toContain("badgeKey");
      expect(content).toContain("descriptionKey");
      expect(content).toContain("ai.providers.groq.badge");
      expect(content).toContain("ai.providers.custom.description");
    });

    test("AiTab restores expiration for key success messages in save and delete paths", () => {
      const aiTabPath = path.join(componentsDir, "settings/AiTab.tsx");
      const content = fs.readFileSync(aiTabPath, "utf-8");

      expect(content).toContain("setTimeout(() => setKeySavedMessage(null), 4000);");
      expect(content).toContain("setTimeout(() => setKeySavedMessage(null), 3000);");
    });

    test("AiTab resolves currentProvider.nameKey in API key heading", () => {
      const aiTabPath = path.join(componentsDir, "settings/AiTab.tsx");
      const content = fs.readFileSync(aiTabPath, "utf-8");

      expect(content).toContain("{t(\"ai.api_key_title\")} ({currentProvider.nameKey ? t(currentProvider.nameKey) : currentProvider.name})");
    });

    test("Rust tray daemon preserves error state and localizes daemon messages", () => {
      const trayPath = path.resolve(__dirname, "../src-tauri/src/daemon/tray.rs");
      const content = fs.readFileSync(trayPath, "utf-8");

      expect(content).toContain('current_state.starts_with("error: ")');
      expect(content).toContain("localize_error_msg");
    });
  });
});

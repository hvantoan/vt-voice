import { describe, expect, test } from "bun:test";
import {
  computeProgressPercent,
  formatBytes,
  normalizeVersionLabel,
} from "../src/lib/updater";

describe("updater helpers", () => {
  test("normalizeVersionLabel ensures single v prefix", () => {
    expect(normalizeVersionLabel("0.1.3")).toBe("v0.1.3");
    expect(normalizeVersionLabel("v0.1.3")).toBe("v0.1.3");
    expect(normalizeVersionLabel("  v1.2.0 ")).toBe("v1.2.0");
  });

  test("computeProgressPercent calculates clamped integer percentage", () => {
    expect(computeProgressPercent(0, null)).toBe(0);
    expect(computeProgressPercent(500, 0)).toBe(0);
    expect(computeProgressPercent(50, 100)).toBe(50);
    expect(computeProgressPercent(150, 100)).toBe(100);
  });

  test("formatBytes formats B, KB, and MB cleanly", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

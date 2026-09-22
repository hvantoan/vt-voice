import { describe, test, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

describe("CI/CD and Release Tooling Suite", () => {
  const rootDir = path.resolve(import.meta.dir, "..");

  test("cliff.toml configuration exists and defines conventional commits", () => {
    const cliffPath = path.join(rootDir, "cliff.toml");
    expect(fs.existsSync(cliffPath)).toBe(true);

    const content = fs.readFileSync(cliffPath, "utf-8");
    expect(content).toContain("[remote.github]");
    expect(content).toContain('owner = "hvantoan"');
    expect(content).toContain('repo = "vt-voice"');
    expect(content).toContain("conventional_commits = true");
    expect(content).toContain("✨ Features");
    expect(content).toContain("🐛 Bug Fixes");
  });

  test("version strings across package.json, Cargo.toml, and tauri.conf.json are in sync", () => {
    const pkgPath = path.join(rootDir, "package.json");
    const cargoPath = path.join(rootDir, "src-tauri/Cargo.toml");
    const tauriPath = path.join(rootDir, "src-tauri/tauri.conf.json");

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const tauri = JSON.parse(fs.readFileSync(tauriPath, "utf-8"));
    const cargo = fs.readFileSync(cargoPath, "utf-8");

    const cargoMatch = cargo.match(/\[package\][\s\S]*?version\s*=\s*"([^"]+)"/);
    expect(cargoMatch).not.toBeNull();
    const cargoVersion = cargoMatch ? cargoMatch[1] : "";

    expect(pkg.version).toBe(tauri.version);
    expect(pkg.version).toBe(cargoVersion);
  });

  test("GitHub Actions CI workflow exists and contains frontend and backend jobs", () => {
    const ciPath = path.join(rootDir, ".github/workflows/ci.yml");
    expect(fs.existsSync(ciPath)).toBe(true);

    const content = fs.readFileSync(ciPath, "utf-8");
    expect(content).toContain("oven-sh/setup-bun@v2");
    expect(content).toContain("actions-rust-lang/setup-rust-toolchain@v1");
    expect(content).toContain("bun run build");
    expect(content).toContain("bun test");
    expect(content).toContain("cargo check");
  });

  test("GitHub Actions Release workflow exists and handles tags and binary publishing", () => {
    const releasePath = path.join(rootDir, ".github/workflows/release.yml");
    expect(fs.existsSync(releasePath)).toBe(true);

    const content = fs.readFileSync(releasePath, "utf-8");
    expect(content).toContain("tauri-apps/tauri-action@v0");
    expect(content).toContain("orhun/git-cliff-action@v4");
    expect(content).toContain("SHA256SUMS.txt");
    expect(content).toContain("uploadPlainBinary: true");
    expect(content).toContain("contents: write");
  });

  test("CHANGELOG.md exists and contains v0.1.0 release entry", () => {
    const changelogPath = path.join(rootDir, "CHANGELOG.md");
    expect(fs.existsSync(changelogPath)).toBe(true);

    const content = fs.readFileSync(changelogPath, "utf-8");
    expect(content).toContain("# Changelog");
    expect(content).toContain("[v0.1.0]");
    expect(content).toContain("✨ Features");
    expect(content).toContain("🐛 Bug Fixes");
  });

  test("package.json defines required scripts for test, changelog, and version bumping", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
    expect(pkg.scripts.test).toBe("bun test");
    expect(pkg.scripts.changelog).toBe("bun scripts/changelog.ts");
    expect(pkg.scripts["version:patch"]).toContain("bump-version.ts patch");
    expect(pkg.scripts["version:minor"]).toContain("bump-version.ts minor");
    expect(pkg.scripts["version:major"]).toContain("bump-version.ts major");
  });
});

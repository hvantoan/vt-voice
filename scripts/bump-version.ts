#!/usr/bin/env bun
/**
 * scripts/bump-version.ts
 *
 * Synchronizes versions across all package files in vt-voice:
 *   1. package.json ("version")
 *   2. src-tauri/Cargo.toml ([package] version)
 *   3. src-tauri/tauri.conf.json ("version")
 *
 * Updates CHANGELOG.md and optionally creates a git commit & tag.
 *
 * Usage:
 *   bun scripts/bump-version.ts patch
 *   bun scripts/bump-version.ts minor
 *   bun scripts/bump-version.ts major
 *   bun scripts/bump-version.ts 0.2.0
 *   bun scripts/bump-version.ts patch --git
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateChangelog } from "./changelog";

const ROOT_DIR = path.resolve(import.meta.dir, "..");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
const CARGO_TOML_PATH = path.join(ROOT_DIR, "src-tauri/Cargo.toml");
const TAURI_CONF_PATH = path.join(ROOT_DIR, "src-tauri/tauri.conf.json");
const CHANGELOG_PATH = path.join(ROOT_DIR, "CHANGELOG.md");

interface VersionParts {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): VersionParts {
  const match = version.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid semver version format: "${version}". Expected format: X.Y.Z (e.g. 0.2.0)`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function calculateNextVersion(currentVersion: string, bumpType: string): string {
  const { major, minor, patch } = parseSemver(currentVersion);

  switch (bumpType.toLowerCase()) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default: {
      // Direct version string provided
      const custom = parseSemver(bumpType);
      return `${custom.major}.${custom.minor}.${custom.patch}`;
    }
  }
}

function updateFiles(newVersion: string): void {
  // 1. Update package.json
  const pkgContent = fs.readFileSync(PACKAGE_JSON_PATH, "utf-8");
  const pkg = JSON.parse(pkgContent) as { version: string; [key: string]: unknown };
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
  console.log(`[Version] Updated package.json: ${oldVersion} -> ${newVersion}`);

  // 2. Update src-tauri/Cargo.toml ([package] section only)
  const cargoContent = fs.readFileSync(CARGO_TOML_PATH, "utf-8");
  const updatedCargo = cargoContent.replace(
    /(\[package\][\s\S]*?version\s*=\s*")([^"]+)(")/,
    `$1${newVersion}$3`
  );
  if (updatedCargo === cargoContent) {
    throw new Error("Failed to find and update [package] version in src-tauri/Cargo.toml");
  }
  fs.writeFileSync(CARGO_TOML_PATH, updatedCargo, "utf-8");
  console.log(`[Version] Updated src-tauri/Cargo.toml: ${oldVersion} -> ${newVersion}`);

  // 3. Update src-tauri/tauri.conf.json
  const tauriContent = fs.readFileSync(TAURI_CONF_PATH, "utf-8");
  const tauriConfig = JSON.parse(tauriContent) as { version: string; [key: string]: unknown };
  tauriConfig.version = newVersion;
  fs.writeFileSync(TAURI_CONF_PATH, `${JSON.stringify(tauriConfig, null, 2)}\n`, "utf-8");
  console.log(`[Version] Updated src-tauri/tauri.conf.json: ${oldVersion} -> ${newVersion}`);
}

// Main execution
const rawArgs = process.argv.slice(2);
const shouldGitCommit = rawArgs.includes("--git");
const bumpArg = rawArgs.find((arg) => !arg.startsWith("--"));

if (!bumpArg) {
  console.error("Usage: bun scripts/bump-version.ts <patch|minor|major|x.y.z> [--git]");
  process.exit(1);
}

try {
  const currentPkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8")) as { version: string };
  const currentVersion = currentPkg.version;
  const nextVersion = calculateNextVersion(currentVersion, bumpArg);

  console.log(`\n🚀 Bumping vt-voice from v${currentVersion} to v${nextVersion}...\n`);

  updateFiles(nextVersion);

  // Update Cargo.lock if possible via cargo metadata or check
  try {
    execSync("cargo check --manifest-path src-tauri/Cargo.toml", {
      cwd: ROOT_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(`[Version] Updated src-tauri/Cargo.lock`);
  } catch {
    // If cargo check fails or takes too long, Cargo.lock will be updated during next build
  }

  // Regenerate CHANGELOG.md
  const changelog = generateChangelog();
  fs.writeFileSync(CHANGELOG_PATH, changelog, "utf-8");
  console.log(`[Changelog] Regenerated ${CHANGELOG_PATH}`);

  if (shouldGitCommit) {
    const tagName = `v${nextVersion}`;
    execSync(
      `git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock CHANGELOG.md`,
      { cwd: ROOT_DIR, stdio: "inherit" }
    );
    execSync(`git commit -m "chore(release): ${tagName}"`, {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
    execSync(`git tag -a "${tagName}" -m "Release ${tagName}"`, {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
    console.log(`\n✅ Successfully committed and tagged ${tagName}!`);
    console.log(`To publish release, run:`);
    console.log(`  git push origin main --follow-tags\n`);
  } else {
    console.log(`\n✅ Version bump complete!`);
    console.log(`Next steps:`);
    console.log(`  1. Review changes: git diff`);
    console.log(`  2. Commit and tag:`);
    console.log(`     git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/Cargo.lock CHANGELOG.md`);
    console.log(`     git commit -m "chore(release): v${nextVersion}"`);
    console.log(`     git tag -a "v${nextVersion}" -m "Release v${nextVersion}"`);
    console.log(`     git push origin main --follow-tags\n`);
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ Error during version bump: ${message}`);
  process.exit(1);
}

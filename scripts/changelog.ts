#!/usr/bin/env bun
/**
 * scripts/changelog.ts
 *
 * Local & CI changelog generator for vt-voice.
 * Reads git tags and commit history, groups changes following Conventional Commits,
 * formats release sections, and writes CHANGELOG.md (or prints release notes for a specific tag).
 *
 * Usage:
 *   bun run scripts/changelog.ts             # Updates CHANGELOG.md for all releases
 *   bun run scripts/changelog.ts --tag v0.1.0 # Prints release notes for tag v0.1.0
 *   bun run scripts/changelog.ts --stdout    # Dumps full changelog to stdout without writing
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_URL = "https://github.com/hvantoan/vt-voice";
const CHANGELOG_PATH = path.resolve(import.meta.dir, "../CHANGELOG.md");

interface CommitItem {
  hash: string;
  subject: string;
  type: string;
  scope?: string;
  message: string;
  breaking: boolean;
  pr?: string;
}

interface ReleaseSection {
  tag: string;
  version: string;
  date: string;
  previousTag?: string;
  commits: CommitItem[];
}

const CATEGORY_MAP: Record<string, { title: string; order: number }> = {
  feat: { title: "✨ Features", order: 1 },
  fix: { title: "🐛 Bug Fixes", order: 2 },
  perf: { title: "⚡ Performance", order: 3 },
  style: { title: "🎨 UI & Styling", order: 4 },
  refactor: { title: "🚜 Refactoring", order: 5 },
  docs: { title: "📚 Documentation", order: 6 },
  test: { title: "🧪 Testing", order: 7 },
  build: { title: "📦 Build", order: 8 },
  ci: { title: "⚙️ CI/CD", order: 9 },
  chore: { title: "🔧 Chores & Maintenance", order: 10 },
  other: { title: "📌 Other Changes", order: 99 },
};

function runGit(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parseCommit(line: string): CommitItem | null {
  const parts = line.split("::");
  if (parts.length < 2) return null;

  const [hash, rawSubject] = parts;
  const subject = rawSubject.trim();

  // Skip noise
  if (/^Merge\s+/i.test(subject)) return null;
  if (/^chore\((release|version)\):/i.test(subject)) return null;

  // Extract PR reference e.g. (#8)
  const prMatch = subject.match(/\(#([0-9]+)\)$/);
  const pr = prMatch ? prMatch[1] : undefined;
  const cleanSubject = prMatch ? subject.replace(/\s*\(#[0-9]+\)$/, "") : subject;

  // Check conventional commit pattern: type(scope)!: message or type: message
  const convMatch = cleanSubject.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/i);

  if (convMatch) {
    const [, rawType, scope, bang, message] = convMatch;
    const type = rawType.toLowerCase();
    return {
      hash: hash.substring(0, 7),
      subject,
      type: CATEGORY_MAP[type] ? type : "other",
      scope: scope?.trim(),
      message: message.trim(),
      breaking: !!bang || /breaking\s+change/i.test(subject),
      pr,
    };
  }

  // Fallback for non-conventional commit
  return {
    hash: hash.substring(0, 7),
    subject,
    type: "other",
    message: cleanSubject,
    breaking: false,
    pr,
  };
}

function getReleases(): ReleaseSection[] {
  // Get all version tags sorted by version tag order
  const rawTags = runGit("tag -l --sort=-v:refname").split("\n").filter(Boolean);
  const tags = rawTags.filter((t) => /^v[0-9]/.test(t));

  const sections: ReleaseSection[] = [];

  // If there are unreleased commits on top of latest tag
  const latestTag = tags[0];
  const unreleasedRange = latestTag ? `${latestTag}..HEAD` : "HEAD";
  const unreleasedLog = runGit(`log ${unreleasedRange} --pretty=format:"%H::%s"`);

  if (unreleasedLog) {
    const commits = unreleasedLog
      .split("\n")
      .map(parseCommit)
      .filter((c): c is CommitItem => c !== null);

    if (commits.length > 0) {
      sections.push({
        tag: "Unreleased",
        version: "Unreleased",
        date: new Date().toISOString().split("T")[0],
        previousTag: latestTag,
        commits,
      });
    }
  }

  // Iterate over tagged releases
  for (let i = 0; i < tags.length; i++) {
    const currentTag = tags[i];
    const prevTag = tags[i + 1];
    const tagDate = runGit(`log -1 --format=%ai ${currentTag}`).split(" ")[0] || new Date().toISOString().split("T")[0];

    const range = prevTag ? `${prevTag}..${currentTag}` : currentTag;
    const log = runGit(`log ${range} --pretty=format:"%H::%s"`);
    const commits = log
      .split("\n")
      .map(parseCommit)
      .filter((c): c is CommitItem => c !== null);

    sections.push({
      tag: currentTag,
      version: currentTag.replace(/^v/, ""),
      date: tagDate,
      previousTag: prevTag,
      commits,
    });
  }

  return sections;
}

function formatReleaseMarkdown(section: ReleaseSection): string {
  const lines: string[] = [];

  if (section.tag === "Unreleased") {
    lines.push(`## [Unreleased](${REPO_URL}/compare/${section.previousTag}...HEAD) — ${section.date}`);
  } else if (section.previousTag) {
    lines.push(`## [${section.tag}](${REPO_URL}/compare/${section.previousTag}...${section.tag}) — ${section.date}`);
  } else {
    lines.push(`## [${section.tag}](${REPO_URL}/releases/tag/${section.tag}) — ${section.date}`);
  }
  lines.push("");

  // Group commits by category
  const groups: Record<string, CommitItem[]> = {};
  for (const commit of section.commits) {
    const key = commit.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(commit);
  }

  // Sort categories by predefined order
  const sortedCategories = Object.keys(groups).sort((a, b) => {
    const orderA = CATEGORY_MAP[a]?.order ?? 99;
    const orderB = CATEGORY_MAP[b]?.order ?? 99;
    return orderA - orderB;
  });

  for (const cat of sortedCategories) {
    const catInfo = CATEGORY_MAP[cat] || { title: "📌 Other Changes" };
    lines.push(`### ${catInfo.title}`);

    for (const c of groups[cat]) {
      const scopePrefix = c.scope ? `**${c.scope}**: ` : "";
      const breakingPrefix = c.breaking ? "[**BREAKING**] " : "";
      const commitLink = `([${c.hash}](${REPO_URL}/commit/${c.hash}))`;
      const prLink = c.pr ? ` ([#${c.pr}](${REPO_URL}/pull/${c.pr}))` : "";

      lines.push(`- ${scopePrefix}${breakingPrefix}${c.message}${prLink} ${commitLink}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function generateChangelog(): string {
  const sections = getReleases();
  const header = `# Changelog\n\nAll notable changes to **vt-voice** will be documented in this file.\nThis project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Conventional Commits](https://www.conventionalcommits.org/).\n\n`;

  const renderedSections = sections.map(formatReleaseMarkdown).join("\n\n---\n\n");
  const footer = `\n\n<!-- generated by vt-voice changelog generator -->\n`;

  return header + renderedSections + footer;
}

export function getReleaseNotesForTag(tag: string): string | null {
  const sections = getReleases();
  const normalized = tag.startsWith("v") ? tag : `v${tag}`;
  const section = sections.find((s) => s.tag.toLowerCase() === normalized.toLowerCase());
  if (!section) return null;
  return formatReleaseMarkdown(section);
}

// CLI Execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const tagIndex = args.indexOf("--tag");
  const isStdout = args.includes("--stdout");

  if (tagIndex !== -1 && args[tagIndex + 1]) {
    const tag = args[tagIndex + 1];
    const notes = getReleaseNotesForTag(tag);
    if (!notes) {
      console.error(`Error: Tag "${tag}" not found in git repository.`);
      process.exit(1);
    }
    console.log(notes);
  } else {
    const markdown = generateChangelog();
    if (isStdout) {
      console.log(markdown);
    } else {
      fs.writeFileSync(CHANGELOG_PATH, markdown, "utf-8");
      console.log(`[Changelog] Successfully updated ${CHANGELOG_PATH}`);
    }
  }
}

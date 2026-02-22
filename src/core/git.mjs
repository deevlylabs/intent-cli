// Git diff parsing with hunk extraction.

import { execSync } from "node:child_process";

/**
 * Get the raw unified diff between base and head.
 * In local mode: base defaults to HEAD~1, head to HEAD.
 * In CI: use DIFF_BASE / DIFF_HEAD env vars.
 */
export function getRawDiff({ base, head, cwd } = {}) {
  const b = base ?? process.env.DIFF_BASE ?? "HEAD~1";
  const h = head ?? process.env.DIFF_HEAD ?? "HEAD";
  try {
    return execSync(`git diff --unified=3 --no-color ${b}...${h}`, {
      encoding: "utf-8",
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return execSync(`git diff --unified=3 --no-color ${b} ${h}`, {
      encoding: "utf-8",
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
  }
}

/**
 * Get list of changed file paths via --name-only (fallback for when full diff is unavailable).
 */
export function getChangedFilesList({ base, head, cwd } = {}) {
  if (process.env.CHANGED_FILES) {
    return process.env.CHANGED_FILES.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
  }
  const b = base ?? process.env.DIFF_BASE ?? "HEAD~1";
  const h = head ?? process.env.DIFF_HEAD ?? "HEAD";
  try {
    const out = execSync(`git diff --name-only ${b}...${h}`, { encoding: "utf-8", cwd });
    return out.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
  } catch {
    const out = execSync(`git diff --name-only ${b} ${h}`, { encoding: "utf-8", cwd });
    return out.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
  }
}

const DIFF_FILE_RE = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse a unified diff string into structured file entries with hunks.
 * Returns: Array<{ path, hunks: Array<{ oldStart, oldLines, newStart, newLines }> }>
 */
export function parseDiff(diffText) {
  const files = [];
  let currentFile = null;

  for (const line of diffText.split("\n")) {
    const fileMatch = line.match(DIFF_FILE_RE);
    if (fileMatch) {
      currentFile = { path: normalizeToPosx(fileMatch[2]), hunks: [] };
      files.push(currentFile);
      continue;
    }

    if (!currentFile) continue;

    const hunkMatch = line.match(HUNK_RE);
    if (hunkMatch) {
      currentFile.hunks.push({
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] ?? "1", 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] ?? "1", 10),
      });
    }
  }

  return files;
}

function normalizeToPosx(p) {
  return p.replace(/\\/g, "/");
}

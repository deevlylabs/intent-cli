// Repo discovery and .intent file loading.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

/**
 * Walk upward from `start` looking for a directory containing `system.intent`.
 * Falls back to `.git` marker if no intent file found at that level.
 */
export function findRepoRoot(start = process.cwd()) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, "system.intent"))) return dir;
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

export function readText(filePath) {
  return readFileSync(filePath, "utf-8");
}

/**
 * Load all INTENT spec files from a repo root.
 * Returns { systemPath, systemSource, policyFiles: [{ path, source }] }.
 */
export function loadIntentFiles(repoRoot) {
  const systemPath = join(repoRoot, "system.intent");
  if (!existsSync(systemPath)) {
    throw new Error(`No system.intent found in ${repoRoot}`);
  }

  const systemSource = readText(systemPath);

  const policyDir = join(repoRoot, "policies");
  const policyFiles = [];
  if (existsSync(policyDir) && statSync(policyDir).isDirectory()) {
    for (const entry of readdirSync(policyDir).sort()) {
      if (entry.endsWith(".intent")) {
        const p = join(policyDir, entry);
        policyFiles.push({ path: p, source: readText(p) });
      }
    }
  }

  return { systemPath, systemSource, policyFiles };
}

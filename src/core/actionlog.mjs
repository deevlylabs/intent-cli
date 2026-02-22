// Build the Action Log from git diff + domain resolution.

import { resolveDomain } from "./glob.mjs";
import { parseDiff, getRawDiff, getChangedFilesList } from "./git.mjs";

/**
 * Build ModifyFile actions from a git diff.
 * Each action has: kind, path, fileDomain, hunks.
 */
export function buildActionLog({ domains, base, head, cwd, rawDiff }) {
  const diff = rawDiff ?? tryGetDiff({ base, head, cwd });
  let actions;

  if (diff) {
    const files = parseDiff(diff);
    actions = files.map((f) => ({
      kind: "ModifyFile",
      path: f.path,
      fileDomain: resolveDomain(f.path, domains),
      hunks: f.hunks,
    }));
  } else {
    const filePaths = getChangedFilesList({ base, head, cwd });
    actions = filePaths.map((p) => ({
      kind: "ModifyFile",
      path: p,
      fileDomain: resolveDomain(p, domains),
      hunks: [],
    }));
  }

  return actions;
}

function tryGetDiff(opts) {
  try {
    return getRawDiff(opts);
  } catch {
    return null;
  }
}

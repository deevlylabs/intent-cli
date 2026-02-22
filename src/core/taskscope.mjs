// Task scope resolution — determines which domain a PR/task is scoped to.
// Sources (in priority order): PR header, label, slash command, CLI override, inference.

import { readFileSync, existsSync } from "node:fs";

/**
 * Resolve task scope from available metadata sources.
 * @param {Object} opts
 * @param {string} [opts.scopeOverride] - CLI --scope flag
 * @param {string} [opts.prBody] - PR body text
 * @param {string[]} [opts.labels] - Issue/PR labels
 * @param {import('./actionlog.mjs').Action[]} [opts.actions] - For inference fallback
 * @returns {{ domain: string|null, tags: string[], source: string }}
 */
export function resolveTaskScope({ scopeOverride, prBody, labels, actions } = {}) {
  const body = prBody ?? readPRBody();
  const tags = parseTags(body);

  // 1. CLI override
  if (scopeOverride) {
    return { domain: scopeOverride, tags, source: "cli_override" };
  }

  // 2. PR body header
  const scopeMatch = body.match(/^INTENT-SCOPE:\s*(\S+)/m);
  if (scopeMatch) {
    return { domain: scopeMatch[1], tags, source: "pr_header" };
  }

  // 3. Labels: domain:<Name>
  if (labels && labels.length > 0) {
    for (const label of labels) {
      const m = label.match(/^domain:(\S+)$/);
      if (m) return { domain: m[1], tags, source: "issue_label" };
    }
  }

  // 4. Slash command in body: /intent scope <Domain>
  const slashMatch = body.match(/^\/intent\s+scope\s+(\S+)/m);
  if (slashMatch) {
    return { domain: slashMatch[1], tags, source: "slash_command" };
  }

  // 5. Inference fallback: majority domain of modified files
  if (actions && actions.length > 0) {
    const inferred = inferDomain(actions);
    if (inferred) {
      return { domain: inferred, tags, source: "inferred" };
    }
  }

  return { domain: null, tags, source: "unknown" };
}

function parseTags(body) {
  const tagsLine = body.match(/^INTENT-TAGS:\s*(.+)/m);
  return tagsLine
    ? tagsLine[1].split(",").map((t) => t.trim()).filter(Boolean)
    : [];
}

function readPRBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    try {
      const event = JSON.parse(readFileSync(eventPath, "utf-8"));
      return event.pull_request?.body ?? "";
    } catch { /* fall through */ }
  }
  return process.env.PR_BODY ?? "";
}

/**
 * Infer task domain as the majority domain of modified files.
 * Ties broken lexicographically.
 */
function inferDomain(actions) {
  const counts = {};
  for (const a of actions) {
    if (a.fileDomain) {
      counts[a.fileDomain] = (counts[a.fileDomain] ?? 0) + 1;
    }
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0][0];
}

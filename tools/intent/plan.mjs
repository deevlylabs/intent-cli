#!/usr/bin/env node
// INTENT v2.0-core — MVP policy evaluator
// Zero dependencies. Reads system.intent, evaluates PR diff, outputs intent.plan.json.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

// ── Minimal glob → RegExp ──────────────────────────────────────────

const REGEX_ESCAPE = /[.+^${}()|[\]\\]/g;

function globToRegex(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; ) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        re += "(?:.+/)?";
        i += 3;
      } else {
        re += ".*";
        i += 2;
      }
    } else if (ch === "*") {
      re += "[^/]*";
      i++;
    } else if (ch === "?") {
      re += "[^/]";
      i++;
    } else {
      re += ch.replace(REGEX_ESCAPE, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${re}$`);
}

// ── system.intent parser ───────────────────────────────────────────

function parseSystemIntent(text) {
  const lines = text.split(/\r?\n/);
  let version = null;
  const domains = {};
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;

    const ver = line.match(/^intent\s+(.+)$/);
    if (ver) {
      version = ver[1];
      continue;
    }

    const dom = line.match(/^domain\s+(\w+)\s*\{?\s*$/);
    if (dom) {
      current = dom[1];
      domains[current] = { paths: [] };
      continue;
    }

    if (line === "}") {
      current = null;
      continue;
    }

    if (current && line.startsWith("paths allow")) {
      for (const m of line.matchAll(/"([^"]+)"/g)) {
        domains[current].paths.push(m[1]);
      }
    }
  }

  return { version, domains };
}

// ── File → domain resolution ───────────────────────────────────────

function resolveDomain(filePath, domains) {
  let best = null;
  let bestLen = -1;
  for (const [name, def] of Object.entries(domains)) {
    for (const pattern of def.paths) {
      if (globToRegex(pattern).test(filePath) && pattern.length > bestLen) {
        best = name;
        bestLen = pattern.length;
      }
    }
  }
  return best;
}

// ── PR metadata extraction ─────────────────────────────────────────

function readPRBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    try {
      const event = JSON.parse(readFileSync(eventPath, "utf-8"));
      return event.pull_request?.body ?? "";
    } catch { /* fall through to env */ }
  }
  return process.env.PR_BODY ?? "";
}

function parseTask(body) {
  const scopeMatch = body.match(/^INTENT-SCOPE:\s*(\S+)/m);
  const tagsLine = body.match(/^INTENT-TAGS:\s*(.+)/m);
  const tags = tagsLine
    ? tagsLine[1].split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  return {
    domain: scopeMatch ? scopeMatch[1] : null,
    source: scopeMatch ? "pr_header" : "unknown",
    tags,
  };
}

// ── Changed files ──────────────────────────────────────────────────

function changedFiles() {
  if (process.env.CHANGED_FILES) {
    return process.env.CHANGED_FILES.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
  }
  const base = process.env.DIFF_BASE ?? "origin/main";
  const head = process.env.DIFF_HEAD ?? "HEAD";
  const out = execSync(`git diff --name-only ${base}...${head}`, {
    encoding: "utf-8",
  });
  return out.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
}

// ── Main evaluation ────────────────────────────────────────────────

function run() {
  const intentCandidates = ["system.intent", "examples/system.intent"];
  const intentFile = intentCandidates.find((f) => existsSync(f));
  if (!intentFile) {
    process.stderr.write("ERROR: no system.intent found in repo root or examples/\n");
    process.exit(2);
  }

  const { version, domains } = parseSystemIntent(readFileSync(intentFile, "utf-8"));
  const domainCount = Object.keys(domains).length;

  const files = changedFiles();
  const task = parseTask(readPRBody());
  const hasBypassTag = task.tags.includes("intentional-cross-domain");

  process.stdout.write(
    `INTENT v${version ?? "2.0"}-core evaluation\n` +
    `  intent file : ${intentFile}\n` +
    `  domains     : ${domainCount} (${Object.keys(domains).join(", ")})\n` +
    `  changed files: ${files.length}\n` +
    `  task.domain : ${task.domain ?? "(unknown)"} (source: ${task.source})\n` +
    `  tags        : ${task.tags.length ? task.tags.join(", ") : "(none)"}\n\n`,
  );

  const violations = [];
  let status = "pass";

  for (const file of files) {
    const fileDomain = resolveDomain(file, domains);

    if (fileDomain === null) {
      violations.push({
        code: "UnknownDomainFile",
        severity: "error",
        confidence: "high",
        evidence: { path: file },
        remediation: {
          actions: ["Map file to a domain in system.intent via paths allow."],
          approved_interfaces: [],
        },
        bypassed: null,
      });
      status = "blocked";
      continue;
    }

    if (task.domain && fileDomain !== task.domain) {
      if (hasBypassTag) {
        violations.push({
          code: "CrossDomainTouch",
          severity: "warn",
          confidence: "high",
          evidence: { path: file, file_domain: fileDomain, task_domain: task.domain },
          remediation: {
            actions: ["Split into separate PR, or confirm cross-domain approval."],
            approved_interfaces: [],
          },
          bypassed: {
            tag: "intentional-cross-domain",
            approval_required: "tech-lead",
            approved: false,
          },
        });
        if (status !== "blocked") status = "warn";
      } else {
        violations.push({
          code: "CrossDomainTouch",
          severity: "error",
          confidence: "high",
          evidence: { path: file, file_domain: fileDomain, task_domain: task.domain },
          remediation: {
            actions: [
              "Split into separate PR, or add INTENT-TAGS: intentional-cross-domain with tech-lead approval.",
            ],
            approved_interfaces: [],
          },
          bypassed: null,
        });
        status = "blocked";
      }
    }
  }

  if (task.source === "unknown" && status === "pass") {
    status = "warn";
  }

  const plan = {
    intent_version: version ?? "2.0",
    status,
    task: {
      domain: task.domain ?? null,
      tags: task.tags,
      source: task.source,
    },
    actions_summary: {
      modify_files: files.length,
      import_cross_domain: 0,
    },
    violations,
  };

  writeFileSync("intent.plan.json", JSON.stringify(plan, null, 2) + "\n");

  if (violations.length === 0) {
    process.stdout.write("No violations.\n");
  } else {
    for (const v of violations) {
      const icon = v.severity === "error" ? "\u2717" : "\u26A0";
      const detail =
        v.code === "CrossDomainTouch"
          ? `${v.evidence.file_domain} \u2260 task ${v.evidence.task_domain}`
          : "unmapped";
      process.stdout.write(`  ${icon} [${v.code}] ${v.evidence.path} \u2014 ${detail}\n`);
    }
  }

  process.stdout.write(
    `\nResult: ${status.toUpperCase()} (${violations.length} violation${violations.length !== 1 ? "s" : ""})\n` +
    `Output: intent.plan.json\n`,
  );

  if (status === "blocked") process.exit(1);
}

run();

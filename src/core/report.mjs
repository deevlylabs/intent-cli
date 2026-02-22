// Pretty report renderer — human-readable output for TTY.
// Falls back to plain text in non-TTY environments (CI).

import chalk, { Chalk } from "chalk";

const isTTY = process.stdout.isTTY ?? false;
const c = isTTY ? chalk : new Chalk({ level: 0 });

const LOGO = "▲ INTENT";

const SEV_ICON = {
  error: c.red("✖"),
  warn: c.yellow("⚠"),
  info: c.blue("ℹ"),
};

const STATUS_LABEL = {
  pass: c.green.bold("PASS"),
  warn: c.yellow.bold("WARN"),
  blocked: c.red.bold("BLOCKED"),
};

// ── Public API ────────────────────────────────────────────────────

export function renderHeader({ intentVersion, systemName, taskDomain, source, fileCount }) {
  const parts = [
    c.bold.cyan(LOGO),
    c.dim(`v${intentVersion}`),
  ];
  if (systemName) parts.push(c.white(`• ${systemName}`));
  if (taskDomain) parts.push(c.white(`• scope: ${taskDomain} (${source})`));
  parts.push(c.dim(`• ${fileCount} file${fileCount !== 1 ? "s" : ""}`));

  return parts.join(" ");
}

export function renderViolation(v, index) {
  const icon = SEV_ICON[v.severity] ?? "?";
  const lines = [];

  lines.push(`  ${icon} [${c.bold(v.code)}] ${v.evidence.path}${v.evidence.first_hunk_line ? `:${v.evidence.first_hunk_line}` : ""}`);

  if (v.message) {
    lines.push(`    ${c.dim(v.message)}`);
  }

  if (v.suggest) {
    lines.push(`    ${c.cyan("→")} ${v.suggest}`);
  }

  if (v.bypassed) {
    lines.push(`    ${c.yellow("⊘")} Bypassed via tag "${v.bypassed.tag}"${v.bypassed.approval_required ? ` (needs ${v.bypassed.approval_required} approval)` : ""}`);
  }

  return lines.join("\n");
}

export function renderSummary(plan) {
  const status = STATUS_LABEL[plan.status] ?? plan.status;
  const errorCount = plan.violations.filter((v) => v.severity === "error").length;
  const warnCount = plan.violations.filter((v) => v.severity === "warn").length;
  const infoCount = plan.violations.filter((v) => v.severity === "info").length;

  const parts = [];
  if (errorCount) parts.push(c.red(`${errorCount} error${errorCount !== 1 ? "s" : ""}`));
  if (warnCount) parts.push(c.yellow(`${warnCount} warning${warnCount !== 1 ? "s" : ""}`));
  if (infoCount) parts.push(c.blue(`${infoCount} info`));

  const counts = parts.length > 0 ? parts.join(", ") : c.green("clean");

  return [
    "",
    c.dim("─".repeat(60)),
    `  ${status}  ${counts}`,
    c.dim("─".repeat(60)),
  ].join("\n");
}

export function renderNextSteps(plan) {
  if (plan.status === "pass") return "";

  const lines = ["\n  " + c.bold("Next steps:")];

  if (plan.task.source === "unknown") {
    lines.push(`  ${c.cyan("→")} Add ${c.bold("INTENT-SCOPE: <Domain>")} to the PR body`);
  }

  const errorViolations = plan.violations.filter((v) => v.severity === "error" && !v.bypassed);
  if (errorViolations.length > 0) {
    lines.push(`  ${c.cyan("→")} Fix ${errorViolations.length} blocking violation${errorViolations.length !== 1 ? "s" : ""} to unblock merge`);
  }

  return lines.join("\n");
}

/**
 * Render the full report.
 */
export function renderReport(plan, { intentVersion, systemName }) {
  const output = [];

  output.push("");
  output.push(renderHeader({
    intentVersion,
    systemName,
    taskDomain: plan.task.domain,
    source: plan.task.source,
    fileCount: plan.actions_summary.modify_files,
  }));
  output.push("");

  if (plan.violations.length === 0) {
    output.push(`  ${c.green("✔")} No violations.`);
  } else {
    const errors = plan.violations.filter((v) => v.severity === "error");
    const warns = plan.violations.filter((v) => v.severity === "warn");
    const infos = plan.violations.filter((v) => v.severity === "info");

    if (errors.length > 0) {
      output.push(`  ${c.red.bold(`🚨 ${errors.length} BLOCKING VIOLATION${errors.length !== 1 ? "S" : ""}`)}`);
      output.push("");
      errors.forEach((v, i) => output.push(renderViolation(v, i)));
      output.push("");
    }

    if (warns.length > 0) {
      output.push(`  ${c.yellow.bold(`⚠ ${warns.length} WARNING${warns.length !== 1 ? "S" : ""}`)}`);
      output.push("");
      warns.forEach((v, i) => output.push(renderViolation(v, i)));
      output.push("");
    }

    if (infos.length > 0) {
      infos.forEach((v, i) => output.push(renderViolation(v, i)));
      output.push("");
    }
  }

  output.push(renderSummary(plan));
  output.push(renderNextSteps(plan));
  output.push("");

  return output.join("\n");
}

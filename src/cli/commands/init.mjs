import { resolve, join, basename } from "node:path";
import { existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import chalk from "chalk";
import { findRepoRoot } from "../../core/fs.mjs";

const SYSTEM_TEMPLATE = (name, domains) =>
  `intent 2.0

system ${name}

import "policies/default.intent"

${domains.map((d) => `domain ${d.name} {\n  paths allow ${d.globs.map((g) => `"${g}"`).join(", ")}\n}`).join("\n\n")}
`;

const POLICY_TEMPLATE = `intent 2.0

policy Default {

  violation CrossDomainTouch confidence high {
    when action.kind == "ModifyFile" && file.domain != null && file.domain != task.domain
    severity error
    message "PR touches {file.domain} but task is scoped to {task.domain}: {file.path}"
    suggest "Split into separate PR, or tag intentional-cross-domain with approval."
    except_when tagged "intentional-cross-domain" requires_approval "tech-lead"
  }

  violation UnknownDomainFile confidence high {
    when action.kind == "ModifyFile" && file.domain == null
    severity error
    message "File {file.path} is not mapped to any domain."
    suggest "Map this file to a domain in system.intent via paths allow."
  }
}
`;

const TOP_LEVEL_SKIP = new Set([
  "node_modules", ".git", ".github", "dist", "build", "coverage",
  ".vscode", ".idea", ".cursor", "__pycache__", ".next", ".nuxt",
  "vendor", "target", "out",
  "policies", "contracts",
]);

export function registerInit(program) {
  program
    .command("init")
    .description("Scaffold system.intent and policies for this repo")
    .option("--force", "overwrite existing files")
    .action((opts) => {
      const cwd = program.opts().cwd;
      const repoRoot = resolve(findRepoRoot(cwd ?? process.cwd()));
      const force = opts.force ?? false;

      const systemPath = join(repoRoot, "system.intent");
      const policyDir = join(repoRoot, "policies");
      const policyPath = join(policyDir, "default.intent");

      const systemName = sanitizeName(basename(repoRoot));
      const domains = inferDomains(repoRoot);

      let created = 0;

      if (!existsSync(systemPath) || force) {
        writeFileSync(systemPath, SYSTEM_TEMPLATE(systemName, domains));
        console.log(chalk.green("  ✔") + ` Created ${chalk.bold("system.intent")} (${domains.length} domains inferred)`);
        created++;
      } else {
        console.log(chalk.yellow("  ⊘") + " system.intent already exists (use --force to overwrite)");
      }

      if (!existsSync(policyDir)) {
        mkdirSync(policyDir, { recursive: true });
      }
      if (!existsSync(policyPath) || force) {
        writeFileSync(policyPath, POLICY_TEMPLATE);
        console.log(chalk.green("  ✔") + ` Created ${chalk.bold("policies/default.intent")}`);
        created++;
      } else {
        console.log(chalk.yellow("  ⊘") + " policies/default.intent already exists (use --force to overwrite)");
      }

      if (created > 0) {
        console.log(`\n  ${chalk.cyan("→")} Run ${chalk.bold("intent plan")} to evaluate your first diff.`);
      }
    });
}

function inferDomains(repoRoot) {
  const domains = [];

  try {
    const entries = readdirSync(repoRoot);
    for (const entry of entries.sort()) {
      if (entry.startsWith(".") || TOP_LEVEL_SKIP.has(entry)) continue;
      const fullPath = join(repoRoot, entry);
      if (!statSync(fullPath).isDirectory()) continue;

      domains.push({
        name: capitalize(entry),
        globs: [`${entry}/**`],
      });
    }
  } catch { /* empty fallback */ }

  if (domains.length === 0) {
    domains.push({ name: "Core", globs: ["**"] });
  }

  return domains;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

function sanitizeName(s) {
  return capitalize(s.replace(/[^a-zA-Z0-9_-]/g, ""));
}

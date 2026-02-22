import { resolve, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import { findRepoRoot } from "../../core/fs.mjs";
import { runPlan } from "../../core/index.mjs";

export function registerFix(program) {
  program
    .command("fix")
    .description("Apply deterministic auto-fixes for violations")
    .option("--scope <domain>", "override task domain scope")
    .option("--base <ref>", "diff base ref")
    .option("--head <ref>", "diff head ref")
    .option("--dry-run", "show fixes without applying")
    .action((opts) => {
      try {
        const cwd = program.opts().cwd;
        const repoRoot = resolve(findRepoRoot(cwd ?? process.cwd()));

        const { plan } = runPlan({
          repoRoot,
          scope: opts.scope,
          base: opts.base,
          head: opts.head,
          outPath: join(repoRoot, "intent.plan.json"),
          jsonOnly: true,
        });

        const fixable = plan.violations.filter((v) => v.code === "UnknownDomainFile");

        if (fixable.length === 0) {
          console.log(chalk.green("  ✔") + " No auto-fixable violations found.");
          return;
        }

        console.log(`  Found ${chalk.bold(fixable.length)} fixable violation${fixable.length !== 1 ? "s" : ""} (UnknownDomainFile)\n`);

        const systemPath = join(repoRoot, "system.intent");
        let systemContent = readFileSync(systemPath, "utf-8");

        for (const v of fixable) {
          const filePath = v.evidence.path;
          const suggested = suggestDomainGlob(filePath);

          if (opts.dryRun) {
            console.log(`  ${chalk.cyan("→")} Would add ${chalk.bold(`"${suggested}"`)} to system.intent`);
          } else {
            systemContent = insertGlobIntoSystem(systemContent, suggested);
            console.log(`  ${chalk.green("✔")} Added glob ${chalk.bold(`"${suggested}"`)} to system.intent`);
          }
        }

        if (!opts.dryRun) {
          writeFileSync(systemPath, systemContent);
          console.log(`\n  ${chalk.cyan("→")} Run ${chalk.bold("intent plan")} to verify.`);
        }
      } catch (err) {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(1);
      }
    });
}

/**
 * Derive a reasonable glob from a file path.
 * e.g. "app/billing/invoice.ts" → "app/billing/**"
 */
function suggestDomainGlob(filePath) {
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length <= 1) return `${filePath}`;
  return `${parts.slice(0, 2).join("/")}/**`;
}

/**
 * Insert a glob into the last domain block in system.intent, or create an Unmapped domain.
 */
function insertGlobIntoSystem(content, glob) {
  const lastDomainClose = content.lastIndexOf("}");
  if (lastDomainClose === -1) {
    return content + `\ndomain Unmapped {\n  paths allow "${glob}"\n}\n`;
  }
  const insertion = `\ndomain Unmapped {\n  paths allow "${glob}"\n}\n`;
  return content.slice(0, lastDomainClose + 1) + "\n" + insertion + content.slice(lastDomainClose + 1);
}

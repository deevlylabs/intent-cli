import { resolve } from "node:path";
import { findRepoRoot } from "../../core/fs.mjs";
import { runPlan } from "../../core/index.mjs";

export function registerPlan(program) {
  program
    .command("plan")
    .description("Evaluate policies against current PR / diff")
    .option("--scope <domain>", "override task domain scope")
    .option("--base <ref>", "diff base ref (default: HEAD~1 or DIFF_BASE env)")
    .option("--head <ref>", "diff head ref (default: HEAD or DIFF_HEAD env)")
    .option("--json", "output JSON only (no pretty report)")
    .option("--out <path>", "output path for intent.plan.json")
    .action((opts) => {
      try {
        const cwd = program.opts().cwd;
        const repoRoot = resolve(findRepoRoot(cwd ?? process.cwd()));

        const { report, exitCode } = runPlan({
          repoRoot,
          scope: opts.scope,
          base: opts.base,
          head: opts.head,
          outPath: opts.out,
          jsonOnly: opts.json,
        });

        process.stdout.write(report + "\n");
        process.exit(exitCode);
      } catch (err) {
        if (!opts.json) {
          process.stderr.write(`Error: ${err.message}\n`);
        } else {
          process.stdout.write(JSON.stringify({ error: err.message }) + "\n");
        }
        process.exit(2);
      }
    });
}

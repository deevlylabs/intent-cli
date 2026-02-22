#!/usr/bin/env node

import { Command } from "commander";
import { registerPlan } from "./commands/plan.mjs";
import { registerInit } from "./commands/init.mjs";
import { registerFix } from "./commands/fix.mjs";

process.on("unhandledRejection", (err) => {
  process.stderr.write(`Unhandled error: ${err?.message ?? err}\n`);
  process.exit(2);
});

const program = new Command();

program
  .name("intent")
  .description("▲ INTENT — architectural governance for the agentic era")
  .version("2.0.0")
  .option("--cwd <path>", "override repository root directory")
  .option("--no-color", "disable color output");

registerPlan(program);
registerInit(program);
registerFix(program);

program.parse();

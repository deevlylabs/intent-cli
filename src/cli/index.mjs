#!/usr/bin/env node

import { Command } from "commander";
import chalk, { Chalk } from "chalk";
import { registerPlan } from "./commands/plan.mjs";
import { registerInit } from "./commands/init.mjs";
import { registerFix } from "./commands/fix.mjs";

process.on("unhandledRejection", (err) => {
  process.stderr.write(`Unhandled error: ${err?.message ?? err}\n`);
  process.exit(2);
});

const noColor = process.argv.includes("--no-color");
const c = noColor ? new Chalk({ level: 0 }) : chalk;

const LINE = "\u2500".repeat(50);

function brandedHelp() {
  const lines = [
    "",
    LINE,
    "",
    `${c.bold.cyan("\u25B2  INTENT")} ${c.bold.cyan("v2.0")}`,
    `   ${c.dim("Architectural Governance for the Agentic Era")}`,
    "",
    LINE,
    "",
    `${c.bold("Usage:")}`,
    "  intent <command> [options]",
    "",
    `${c.bold("Commands:")}`,
    "  plan        Evaluate policies against current PR / diff",
    "  init        Scaffold system.intent and policies",
    "  fix         Apply deterministic auto-fixes",
    "",
    `${c.bold("Global Options:")}`,
    "  -V, --version",
    "  --cwd <path>",
    "  --no-color",
    "  -h, --help",
    "",
    LINE,
    c.dim.italic("Stateless. Deterministic. PR-time enforcement."),
    "",
  ];
  return lines.join("\n");
}

const program = new Command();

program
  .name("intent")
  .version("2.0.0", "-V, --version")
  .option("--cwd <path>", "override repository root directory")
  .option("--no-color", "disable color output")
  .action(() => {
    process.stdout.write(brandedHelp() + "\n");
  });

program.helpInformation = () => brandedHelp() + "\n";

registerPlan(program);
registerInit(program);
registerFix(program);

program.parse();

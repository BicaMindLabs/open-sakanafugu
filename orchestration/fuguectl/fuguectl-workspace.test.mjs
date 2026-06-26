#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-workspace");
const workspace = join(here, "fuguectl-workspace");
const tmp = makeTempDir();
const calls = join(tmp, "workspace-calls.txt");

process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_WORKSPACE_CALLS = calls;

writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "const argv = process.argv.slice(2);",
    "fs.appendFileSync(process.env.FUGUE_WORKSPACE_CALLS, argv.join(' ') + '\\n');",
    "const root = argv[0];",
    "const cmd = argv[1];",
    "const args = argv.slice(2);",
    "if (root !== 'workspace') {",
    "  console.error('expected workspace');",
    "  process.exit(9);",
    "}",
    "let name = '';",
    "for (let i = 0; i < args.length; i += 1) {",
    "  const arg = args[i];",
    "  if (['--dir', '--allocation', '--stats', '--experience', '--task'].includes(arg)) {",
    "    i += 1;",
    "  } else if (!arg.startsWith('--')) {",
    "    name = arg;",
    "    break;",
    "  }",
    "}",
    "if (cmd === 'list') {",
    "  process.stdout.write('  code       You are at the code station.\\n  review     Review only correctness.\\n  main       Plan and route.\\n  sql        SQL station.\\n  web        Web station.\\n  chinese    Chinese docs.\\n');",
    "} else if (cmd === 'show' && name === 'code') {",
    "  process.stdout.write('prompt: code\\nmodels: @bench:code\\ntools: read,edit,write,bash\\n');",
    "} else if (cmd === 'model' && name === 'code') {",
    "  process.stdout.write('minimax,doubao,glm\\n');",
    "} else if (cmd === 'model' && name === 'review') {",
    "  process.stdout.write('coder\\n');",
    "} else if (cmd === 'context' && name === 'code') {",
    "  const taskIndex = args.indexOf('--task');",
    "  const task = taskIndex === -1 ? '' : args[taskIndex + 1] || '';",
    "  const taskBlock = task.length > 0 ? '### Task\\n' + task + '\\n\\n' : '';",
    "  process.stdout.write('## Context - workspace: code\\n\\n### System Prompt\\nKeep review independent from implementation.\\n\\n### Workspace Prompt\\ncode station\\n\\n### Tools\\nread edit write bash  (only this station enabled, the rest not exposed)\\n\\n### Memory\\nscope: event,experience  (only memory relevant to this scope, not the full archive)\\n\\n### History\\nlast few conversation rounds + key execution trace (not the full transcript)\\n\\n' + taskBlock + '> suggested model(bench): minimax,doubao,glm\\n');",
    "} else {",
    "  console.error('no workspace ' + (name || ''));",
    "  process.exit(1);",
    "}",
    "",
  ].join("\n"),
);

suite.ok(
  "list shows >=6 stations",
  () => run(workspace, ["list"]).stdout.trim().split(/\n/u).length >= 6,
);
suite.ok("list includes code/review/main", () => {
  const out = run(workspace, ["list"]).stdout;
  return out.includes("code") && out.includes("review") && out.includes("main");
});

suite.ok("show code has models field", () =>
  run(workspace, ["show", "code"]).stdout.includes("models:"),
);
suite.ok("model code → bench resolves to minimax", () =>
  run(workspace, ["model", "code"]).stdout.includes("minimax"),
);
suite.ok(
  "model review → coder",
  () => run(workspace, ["model", "review"]).stdout.trim() === "coder",
);

const ctx = run(workspace, ["context", "code"]).stdout;
for (const section of [
  "System Prompt",
  "Workspace Prompt",
  "### Tools",
  "### Memory",
  "### History",
]) {
  suite.ok(`context has [${section}]`, () => ctx.includes(section));
}
suite.ok("context carries global review independence rule", () =>
  ctx.includes("Keep review independent"),
);
suite.ok("context code exposes only this station tools(incl edit)", () =>
  ctx.includes("edit"),
);

suite.ok("context --task injects task", () =>
  run(workspace, ["context", "code", "--task", "doX"]).stdout.includes("doX"),
);
suite.ok(
  "unknown workspace → non-0",
  () => run(workspace, ["context", "nope"]).status !== 0,
);
suite.ok("no subcommand → shows help(incl list)", () =>
  run(workspace, []).stdout.includes("list"),
);
suite.ok("wrapper delegates to engine CLI", () =>
  readFileSync(calls, "utf8").includes("workspace context code --task doX\n"),
);

suite.done();

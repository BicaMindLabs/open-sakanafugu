#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-init");
const init = join(here, "fuguectl-init");
const fuguectl = join(here, "fuguectl");
const tmp = makeTempDir();
const calls = join(tmp, "init-calls.txt");

process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_INIT_CALLS = calls;

writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "fs.appendFileSync(process.env.FUGUE_INIT_CALLS, `${process.argv.slice(2).join(' ')}\\n`);",
    "const [root, ...args] = process.argv.slice(2);",
    "if (root !== 'init') {",
    "  console.error('expected init');",
    "  process.exit(9);",
    "}",
    "process.stdout.write('FuguNano init (dry-run)\\nreadiness:\\n  ✓ Codex CLI detected\\n');",
    "",
  ].join("\n"),
  { mode: 0o755 },
);

const help = run(init, ["--help"]).stdout;
suite.ok("help describes dry-run/write", () =>
  help.includes("--dry-run|--write"),
);

const out = run(init, ["--dry-run", "--project", tmp]).stdout;
suite.ok("wrapper emits init output", () => out.includes("FuguNano init"));
suite.ok("wrapper delegates to engine CLI", () =>
  readFileSync(calls, "utf8").includes(`init --dry-run --project ${tmp}\n`),
);

const top = run(fuguectl, ["init", "--dry-run"]).stdout;
suite.ok("top-level init entrypoint works", () => top.includes("readiness:"));

suite.done();

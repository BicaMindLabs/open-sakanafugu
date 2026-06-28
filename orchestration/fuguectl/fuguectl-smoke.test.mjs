#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-smoke");
const smoke = join(here, "fuguectl-smoke");
const tmp = makeTempDir();
const calls = join(tmp, "smoke-calls.txt");

process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_SMOKE_CALLS = calls;

writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "const args = process.argv.slice(2);",
    "fs.appendFileSync(process.env.FUGUE_SMOKE_CALLS, args.join(' ') + '\\n');",
    "if (args[0] !== 'smoke') {",
    "  console.error('expected smoke');",
    "  process.exit(9);",
    "}",
    "process.stdout.write('✓ smoke GO (1/1)\\n');",
    "",
  ].join("\n"),
);

const out = run(smoke, ["--harness", "codex"]).stdout;
suite.ok("smoke wrapper emits engine output", () => out.includes("smoke GO"));
suite.ok("wrapper delegates smoke args to engine CLI", () =>
  readFileSync(calls, "utf8").includes("smoke --harness codex\n"),
);

suite.done();

#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-self-harness");
const fuguectl = join(here, "fuguectl");
const tmp = makeTempDir();
const calls = join(tmp, "self-harness-calls.txt");
const spec = join(tmp, "self-harness.json");

process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_SELF_HARNESS_CALLS = calls;

writeFileSync(spec, '{"runId":"r1"}\n');
writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "const args = process.argv.slice(2);",
    "fs.appendFileSync(process.env.FUGUE_SELF_HARNESS_CALLS, args.join(' ') + '\\n');",
    "if (args.join(' ') === 'self-harness template') {",
    '  process.stdout.write(\'{"agent":"cc-deepseek"}\\n\');',
    "  process.exit(0);",
    "}",
    "if (args[0] === 'self-harness' && args[1] === 'run') {",
    "  process.stdout.write('Self-Harness run complete\\n');",
    "  process.exit(0);",
    "}",
    "console.error('unexpected args: ' + args.join(' '));",
    "process.exit(2);",
    "",
  ].join("\n"),
  { mode: 0o755 },
);

suite.ok("help lists self-harness entrypoint", () =>
  run(fuguectl, ["help"]).stdout.includes("fuguectl self-harness template|run"),
);

run(fuguectl, ["self-harness", "template"]);
suite.ok("template delegates to engine CLI", () =>
  readFileSync(calls, "utf8").includes("self-harness template\n"),
);

run(fuguectl, ["self-harness", "run", "--spec", spec]);
suite.ok("run delegates spec args to engine CLI", () =>
  readFileSync(calls, "utf8").includes(`self-harness run --spec ${spec}\n`),
);

suite.done();

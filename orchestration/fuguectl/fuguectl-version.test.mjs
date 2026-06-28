#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-version");
const version = join(here, "fuguectl-version");
const fuguectl = join(here, "fuguectl");
const tmp = makeTempDir();
const calls = join(tmp, "version-calls.txt");

process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_VERSION_CALLS = calls;

writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "fs.appendFileSync(process.env.FUGUE_VERSION_CALLS, `${process.argv.slice(2).join(' ')}\\n`);",
    "const [root] = process.argv.slice(2);",
    "if (root !== 'version') {",
    "  console.error('expected version');",
    "  process.exit(9);",
    "}",
    "process.stdout.write('fugue 0.0.0\\n');",
    "",
  ].join("\n"),
  { mode: 0o755 },
);

const out = run(version, []).stdout;
suite.ok("wrapper emits version output", () => out.includes("fugue 0.0.0"));
suite.ok("wrapper delegates to engine CLI", () =>
  readFileSync(calls, "utf8").includes("version\n"),
);

const top = run(fuguectl, ["version"]).stdout;
suite.ok("top-level version entrypoint works", () =>
  top.includes("fugue 0.0.0"),
);

const help = run(fuguectl, ["help"]).stdout;
suite.ok("help lists version entrypoint", () =>
  help.includes("fuguectl version"),
);

suite.done();

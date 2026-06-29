#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-incident");
const incident = join(here, "fuguectl-incident");
const tmp = makeTempDir();
const calls = join(tmp, "incident-calls.txt");

process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_INCIDENT_CALLS = calls;

writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "const argv = process.argv.slice(2);",
    "fs.appendFileSync(process.env.FUGUE_INCIDENT_CALLS, argv.join(' ') + '\\n');",
    "if (argv[0] !== 'incident') {",
    "  console.error('expected incident');",
    "  process.exit(9);",
    "}",
    "if (argv[1] === 'packet') {",
    "  process.stdout.write('[incident:packet] incidents=1\\n');",
    "  process.exit(0);",
    "}",
    "console.error('unknown incident command');",
    "process.exit(1);",
    "",
  ].join("\n"),
);

const logFile = join(tmp, "failure.log");
writeFileSync(logFile, "VERDICT: NEEDS FIX\n");

suite.ok("help lists incident packet", () =>
  run(incident, ["--help"]).stdout.includes("packet <failure-log|->"),
);
suite.ok("packet delegates to engine CLI", () =>
  run(incident, ["packet", logFile, "--json"]).stdout.includes(
    "[incident:packet]",
  ),
);
suite.ok("fake engine was invoked", () => existsSync(calls));
suite.ok("packet forwards file and json flag", () =>
  readFileSync(calls, "utf8").includes(`incident packet ${logFile} --json\n`),
);
suite.ok(
  "unknown subcommand is nonzero",
  () => run(incident, ["bogus"]).status !== 0,
);

suite.done();

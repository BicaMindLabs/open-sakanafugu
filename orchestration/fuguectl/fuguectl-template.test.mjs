#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-template");
const template = join(here, "fuguectl-template");
const tmp = makeTempDir();
const calls = join(tmp, "template-calls.txt");

process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_TEMPLATE_CALLS = calls;
process.env.FUGUE_TEMPLATES = join(here, "templates");

writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const argv = process.argv.slice(2);",
    "fs.appendFileSync(process.env.FUGUE_TEMPLATE_CALLS, argv.join(' ') + '\\n');",
    "const root = argv[0];",
    "const name = argv[1];",
    "const args = argv.slice(2);",
    "if (root !== 'template') {",
    "  console.error('expected template');",
    "  process.exit(9);",
    "}",
    "const die = (message) => { console.error(message); process.exit(1); };",
    "let dir = process.env.FUGUE_TEMPLATES || '';",
    "const vars = {};",
    "for (let i = 0; i < args.length; i += 1) {",
    "  const arg = args[i];",
    "  if (arg === '--dir') {",
    "    dir = args[i + 1] || '';",
    "    i += 1;",
    "  } else if (arg === '--set') {",
    "    const raw = args[i + 1] || '';",
    "    i += 1;",
    "    const eq = raw.indexOf('=');",
    "    if (eq <= 0) die('--set format should be KEY=VALUE, got ' + raw);",
    "    vars[raw.slice(0, eq)] = raw.slice(eq + 1);",
    "  } else {",
    "    die('unknown arg ' + arg);",
    "  }",
    "}",
    "if (!name) die('missing template name');",
    "const file = path.join(dir, name + '.md');",
    "if (!fs.existsSync(file)) die('no template ' + name);",
    "let content = fs.readFileSync(file, 'utf8');",
    "for (const [key, value] of Object.entries(vars)) content = content.split('{{' + key + '}}').join(value);",
    "process.stdout.write(content.replace(/\\n?$/u, '') + '\\n');",
    "",
  ].join("\n"),
);

const out = run(template, [
  "impl",
  "--set",
  "ROLE=backend",
  "--set",
  "SCOPE=write-parser",
  "--set",
  "FILES=src/p.py",
]).stdout;
suite.ok(
  "impl template renders with substituted values",
  () =>
    out.includes("Your role: backend") &&
    out.includes("write-parser") &&
    out.includes("src/p.py"),
);
suite.ok("set placeholders are replaced", () => !out.includes("{{ROLE}}"));

const out2 = run(template, ["impl", "--set", "ROLE=x"]).stdout;
suite.ok("unset {{SCOPE}} is kept", () => out2.includes("{{SCOPE}}"));

suite.ok("review template renders", () =>
  run(template, [
    "review",
    "--set",
    "REVIEWER=Codex",
    "--set",
    "DIFF_RANGE=main...HEAD",
    "--set",
    "DIFF=x",
  ]).stdout.includes("VERDICT: ACCEPTED"),
);
suite.ok("analysis template renders", () =>
  run(template, ["analysis", "--set", "ROLE=reviewer"]).stdout.includes(
    "must use the Write tool",
  ),
);

suite.ok("no name → non-0", () => run(template, []).status !== 0);
suite.ok(
  "unknown template → non-0",
  () => run(template, ["nope"]).status !== 0,
);
suite.ok(
  "--set without = → non-0",
  () => run(template, ["impl", "--set", "BADFORMAT"]).status !== 0,
);
suite.ok("shell delegates to engine CLI", () =>
  readFileSync(calls, "utf8").includes(
    "template impl --set ROLE=backend --set SCOPE=write-parser --set FILES=src/p.py\n",
  ),
);

suite.done();

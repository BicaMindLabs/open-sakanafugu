#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSuite, here, makeTempDir, run } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-summary");
const summary = join(here, "fuguectl-summary");
const tmp = makeTempDir();
const calls = join(tmp, "summary-calls.txt");

process.env.FUGUE_CACHE = join(tmp, "cache");
process.env.FUGUE_ENGINE_CLI = join(tmp, "fugue-engine");
process.env.FUGUE_SUMMARY_CALLS = calls;

writeFileSync(
  process.env.FUGUE_ENGINE_CLI,
  [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const args = process.argv.slice(2);",
    "fs.appendFileSync(process.env.FUGUE_SUMMARY_CALLS, args.join(' ') + '\\n');",
    "const die = (message) => { console.error(message); process.exit(2); };",
    "const root = args[0];",
    "const round = args[1];",
    "if (root !== 'summary') die('expected summary');",
    "if (!round) die('usage: summary <round>');",
    "const cacheIndex = args.indexOf('--cache');",
    "const cache = cacheIndex === -1 ? (process.env.FUGUE_CACHE || path.join(process.cwd(), '.fuguectl-cache')) : args[cacheIndex + 1];",
    "const taskIndex = args.indexOf('--task');",
    "const task = taskIndex === -1 ? '' : args[taskIndex + 1];",
    "const dir = path.join(cache, 'round-' + round);",
    "const manifest = path.join(dir, 'manifest.tsv');",
    "if (!fs.existsSync(manifest)) die('round-' + round + ' not init');",
    "const rows = fs.readFileSync(manifest, 'utf8').trim().split(/\\n/u).filter(Boolean).map((line) => {",
    "  const parts = line.split('\\t');",
    "  const id = parts[0];",
    "  const agent = parts[1] || '';",
    "  const statusPath = path.join(dir, id + '.status');",
    "  const status = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8').trim() : 'pending';",
    "  return { id, agent, status };",
    "});",
    "const done = rows.filter((row) => row.status === 'done').length;",
    "const fail = rows.filter((row) => row.status === 'fail').length;",
    "const startedPath = path.join(dir, '.started');",
    "const elapsed = fs.existsSync(startedPath) ? String(Math.max(0, Math.floor(Date.now() / 1000) - Number.parseInt(fs.readFileSync(startedPath, 'utf8'), 10))) + 's' : '?';",
    "const status = 'round-' + round + ': total=' + rows.length + ' done=' + done + ' fail=' + fail + ' pending=' + (rows.length - done - fail);",
    "const detail = rows.map((row) => '  ' + row.id.padEnd(22) + ' ' + row.agent.padEnd(14) + ' ' + row.status);",
    "const summary = ['### Round ' + round + ' summary - ' + status + ' - elapsed ' + elapsed].concat(detail).join('\\n');",
    "process.stdout.write(summary + '\\n');",
    "if (task) {",
    "  if (!fs.existsSync(task)) die('no TASK file ' + task);",
    "  fs.appendFileSync(task, '\\n' + summary + '\\n');",
    "  process.stderr.write('written to ' + task + '\\n');",
    "}",
    "",
  ].join("\n"),
);

const round = join(process.env.FUGUE_CACHE, "round-1");
mkdirSync(round, { recursive: true });
writeFileSync(join(round, "manifest.tsv"), "t1\tcc-deepseek\nt2\tcc-glm\n");
writeFileSync(join(round, ".started"), String(Math.floor(Date.now() / 1000)));
writeFileSync(join(round, "t1.result"), "r\n");
writeFileSync(join(round, "t1.status"), "done\n");
writeFileSync(join(round, "t2.status"), "fail\n");
writeFileSync(join(round, "t2.reason"), "timeout\n");

const out = run(summary, ["1"]).stdout;
suite.ok("summary has Round 1 title", () => out.includes("Round 1 summary"));
suite.ok("summary has counts done=1 fail=1", () =>
  out.includes("done=1 fail=1"),
);
suite.ok(
  "summary lists task detail",
  () => out.includes("t1") && out.includes("cc-glm"),
);

const taskFile = join(tmp, "task.md");
writeFileSync(taskFile, "## Log\n");
run(summary, ["1", "--task", taskFile]);
suite.ok("--task writes summary into file", () =>
  readFileSync(taskFile, "utf8").includes("Round 1 summary"),
);

suite.ok("round not init → non-0", () => run(summary, ["9"]).status !== 0);
suite.ok("shell delegates to engine CLI", () =>
  readFileSync(calls, "utf8").includes("summary 1\n"),
);

suite.done();

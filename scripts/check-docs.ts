#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(dirname(process.argv[1] ?? "scripts/check-docs.ts"), "..");
const path = (...parts) => join(root, ...parts);

const fuguectl = path("orchestration", "fuguectl", "fuguectl");
const readmeEn = path("README.md");
const readmeZh = path("README.zh-CN.md");
const overviewEn = path("docs", "readme-overview-en.svg");
const overviewZh = path("docs", "readme-overview-zh.svg");
const fugueDir = path("orchestration", "fuguectl");
const selfDoc = path("docs", "SELF_HARNESS.md");
const selfDomain = path("engine", "src", "domain", "self-harness.ts");
const selfCli = path("engine", "src", "cli", "commands", "self-harness.ts");

let failed = false;
const ok = (message) => console.log(`  ✓ ${message}`);
const no = (message) => {
  console.log(`  ✗ ${message}`);
  failed = true;
};
const die = (message) => {
  console.error(message);
  process.exit(2);
};
const requireFile = (file, message) => {
  if (!existsSync(file)) die(message);
};

requireFile(fuguectl, `check-docs: cannot find ${fuguectl}`);
requireFile(readmeEn, `check-docs: cannot find ${readmeEn}`);
requireFile(
  readmeZh,
  `check-docs: cannot find ${readmeZh} (the repo is bilingual; keep README.zh-CN.md)`,
);
requireFile(overviewEn, `check-docs: cannot find ${overviewEn}`);
requireFile(overviewZh, `check-docs: cannot find ${overviewZh}`);
requireFile(selfDoc, `check-docs: cannot find ${selfDoc}`);
requireFile(selfDomain, `check-docs: cannot find ${selfDomain}`);
requireFile(selfCli, `check-docs: cannot find ${selfCli}`);

console.log("── check-docs: docs vs code ──");

const text = (file) => readFileSync(file, "utf8");
const driver = text(fuguectl);
const bashSubcommands = [...driver.matchAll(/^[ \t]+([a-z][a-z0-9|_-]*)\)/gmu)]
  .map((match) => (match[1] ?? "").replace(/\|.*$/u, ""))
  .filter(
    (command) =>
      command.length > 0 && command !== "help" && command !== "selftest",
  );

const nodeSubcommands = [
  ...driver.matchAll(/\["([a-z][a-z0-9_-]*)",\s*"[^"]+"\]/gu),
]
  .map((match) => match[1] ?? "")
  .filter((command) => command.length > 0 && command !== "round-summary");

const subcommands = [
  ...new Set(bashSubcommands.length > 0 ? bashSubcommands : nodeSubcommands),
];

if (subcommands.length === 0)
  die("check-docs: parsed no subcommands from the driver");

const en = text(readmeEn);
const zh = text(readmeZh);
const overviewEnText = text(overviewEn);
const overviewZhText = text(overviewZh);
for (const command of subcommands) {
  const missing = [];
  if (!en.includes(`fuguectl ${command}`)) missing.push("README.md");
  if (!zh.includes(`fuguectl ${command}`)) missing.push("README.zh-CN.md");
  if (missing.length === 0) ok(`subcommand '${command}' documented`);
  else
    no(
      `subcommand '${command}' not found in:${missing.map((item) => ` ${item}`).join("")} (add a CLI table row)`,
    );
}

if (en.includes(`${String(subcommands.length)} subcommands`))
  ok(
    `${basename(readmeEn)}: subcommand-count claim = ${String(subcommands.length)}`,
  );
else
  no(
    `${basename(readmeEn)}: did not find '${String(subcommands.length)} subcommands' (actual ${String(subcommands.length)}; fix the README's subcommand count)`,
  );

if (zh.includes(`${String(subcommands.length)} 个子命令`))
  ok(
    `${basename(readmeZh)}: subcommand-count claim = ${String(subcommands.length)}`,
  );
else
  no(
    `${basename(readmeZh)}: did not find '${String(subcommands.length)} 个子命令' (actual ${String(subcommands.length)}; fix README.zh-CN's subcommand count)`,
  );

const testSuites = readdirSync(fugueDir).filter((file) =>
  file.endsWith(".test.mjs"),
).length;
if (en.includes(`${String(testSuites)} test suites`))
  ok(`${basename(readmeEn)}: test-suite-count claim = ${String(testSuites)}`);
else
  no(
    `${basename(readmeEn)}: did not find '${String(testSuites)} test suites' (actual ${String(testSuites)}; fix the README's test-suite count)`,
  );

if (zh.includes(`${String(testSuites)} 套测试`))
  ok(`${basename(readmeZh)}: test-suite-count claim = ${String(testSuites)}`);
else
  no(
    `${basename(readmeZh)}: did not find '${String(testSuites)} 套测试' (actual ${String(testSuites)}; fix README.zh-CN's test-suite count)`,
  );

const testFiles = readdirSync(fugueDir).filter((file) =>
  file.endsWith(".test.mjs"),
);
const countSuiteAssertions = (source) => {
  const staticAssertions = [...source.matchAll(/suite\.ok\s*\(/gu)].length;
  const loopExpansion = [
    ...source.matchAll(
      /for\s*\(\s*const\s+\w+\s+of\s+\[([\s\S]*?)\]\s*\)\s*\{([\s\S]*?)\}/gu,
    ),
  ]
    .map((match) => {
      const items = [...(match[1] ?? "").matchAll(/["'`][\s\S]*?["'`]/gu)]
        .length;
      const loopAssertions = [
        ...(match[2] ?? "").matchAll(/suite\.ok\s*\(/gu),
      ].length;
      return Math.max(0, items - 1) * loopAssertions;
    })
    .reduce((sum, count) => sum + count, 0);
  return staticAssertions + loopExpansion;
};
const fugueAssertions = testFiles
  .map((file) => countSuiteAssertions(text(join(fugueDir, file))))
  .reduce((sum, count) => sum + count, 0);
const assertionCount = String(fugueAssertions);
if (en.includes(`assertions-${assertionCount}`))
  ok(`${basename(readmeEn)}: assertion-count badge = ${assertionCount}`);
else
  no(
    `${basename(readmeEn)}: did not find 'assertions-${assertionCount}' (actual ${assertionCount}; fix the README's assertion badge)`,
  );

if (zh.includes(`assertions-${assertionCount}`))
  ok(`${basename(readmeZh)}: assertion-count badge = ${assertionCount}`);
else
  no(
    `${basename(readmeZh)}: did not find 'assertions-${assertionCount}' (actual ${assertionCount}; fix README.zh-CN's assertion badge)`,
  );

if (overviewEnText.includes(`${assertionCount} assertions`))
  ok(`${basename(overviewEn)}: assertion-count claim = ${assertionCount}`);
else
  no(
    `${basename(overviewEn)}: did not find '${assertionCount} assertions' (actual ${assertionCount}; fix the overview SVG)`,
  );

if (overviewZhText.includes(`${assertionCount} 个断言`))
  ok(`${basename(overviewZh)}: assertion-count claim = ${assertionCount}`);
else
  no(
    `${basename(overviewZh)}: did not find '${assertionCount} 个断言' (actual ${assertionCount}; fix the overview SVG)`,
  );

const selfCliText = text(selfCli);
const selfCommands = [
  ...selfCliText.matchAll(/\[\['self-harness',[ \t]*'([^']+)'\]\]/gu),
].map((match) => `self-harness ${match[1] ?? ""}`);
if (selfCommands.length === 0)
  die(`check-docs: parsed no Self-Harness CLI commands from ${selfCli}`);

const selfDocText = text(selfDoc);
for (const command of selfCommands) {
  if (selfDocText.includes(command))
    ok(`${basename(selfDoc)}: documents '${command}'`);
  else no(`${basename(selfDoc)}: missing '${command}'`);
}

const selfDomainText = text(selfDomain);
const surfacesBlock =
  /export const EDITABLE_SURFACES[\s\S]*?\];/u.exec(selfDomainText)?.[0] ?? "";
const surfaces = [...surfacesBlock.matchAll(/'([^']+)'/gu)].map(
  (match) => match[1] ?? "",
);
if (surfaces.length === 0)
  die(`check-docs: parsed no Self-Harness surfaces from ${selfDomain}`);

for (const surface of surfaces) {
  if (selfDocText.includes(`"${surface}"`))
    ok(`${basename(selfDoc)}: documents surface '${surface}'`);
  else no(`${basename(selfDoc)}: missing editable surface '${surface}'`);
}

console.log("");
if (!failed) {
  console.log(
    `✓ check-docs: docs and code are consistent (${String(subcommands.length)} fuguectl subcommands · ${String(testSuites)} fuguectl test suites · ${assertionCount} fuguectl assertions · ${String(selfCommands.length)} self-harness commands · ${String(surfaces.length)} self-harness surfaces)`,
  );
  process.exit(0);
}

console.log("✗ check-docs: docs drift (✗ above) — fix the README and re-run");
process.exit(1);

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(process.argv[1] ?? "backends/install.ts"));
const home = process.env.HOME;
if (home === undefined || home.length === 0) {
  console.error("HOME is not set");
  process.exit(2);
}

const targetBin = join(home, "bin");
const claudeCodeVersion = process.env.CLAUDE_CODE_VERSION ?? "2.1.150";
const providers = [
  "kimi",
  "glm",
  "qwen",
  "deepseek",
  "doubao",
  "minimax",
  "mimo",
  "stepfun",
  "longcat",
];

const installFile = (src, dest, mode) => {
  copyFileSync(src, dest);
  chmodSync(dest, mode);
};

mkdirSync(targetBin, { recursive: true });

installFile(
  join(root, "bin", "cc-models"),
  join(targetBin, "cc-models"),
  0o755,
);
installFile(join(root, "bin", "cc-sync"), join(targetBin, "cc-sync"), 0o755);
installFile(
  join(root, "bin", "cc-model-lib.sh"),
  join(targetBin, "cc-model-lib.sh"),
  0o644,
);
installFile(
  join(root, "bin", "cc-model-registry.tsv"),
  join(targetBin, "cc-model-registry.tsv"),
  0o644,
);
installFile(
  join(root, "bin", "cc-model-research.tsv"),
  join(targetBin, "cc-model-research.tsv"),
  0o644,
);
installFile(
  join(root, "bin", "cc-model-backlog.md"),
  join(targetBin, "cc-model-backlog.md"),
  0o644,
);

for (const provider of providers) {
  installFile(
    join(root, "bin", `${provider}-code`),
    join(targetBin, `${provider}-code`),
    0o755,
  );

  const alias = join(targetBin, `cc-${provider}`);
  rmSync(alias, { force: true });
  symlinkSync(`${provider}-code`, alias);

  const promptDir = join(home, ".claude-envs", provider, "prompts");
  mkdirSync(promptDir, { recursive: true });
  installFile(
    join(root, "prompts", `${provider}-proactive-tools.md`),
    join(promptDir, `${provider}-proactive-tools.md`),
    0o644,
  );
}

if (process.argv.includes("--install-claude-code")) {
  for (const provider of providers) {
    const optDir = join(home, ".claude-envs", provider, "opt");
    mkdirSync(optDir, { recursive: true });
    const result = spawnSync(
      "npm",
      ["install", `@anthropic-ai/claude-code@${claudeCodeVersion}`],
      {
        cwd: optDir,
        stdio: "inherit",
      },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

console.log(`Installed fugue launchers to ${targetBin}`);
console.log("Run: cc-models doctor");

#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(
  dirname(process.argv[1] ?? "scripts/scan-secrets.ts"),
  "..",
);

const run = (cmd, args) =>
  execFileSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

const isGitRepo = () => {
  try {
    run("git", ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
};

const walkFiles = (dir, prefix = "") => {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const abs = join(dir, entry.name);
    const rel = prefix.length === 0 ? entry.name : join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(abs, rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
};

const files = isGitRepo()
  ? run("git", ["ls-files", "--cached", "--others", "--exclude-standard"])
      .split(/\r?\n/u)
      .filter((file) => file.length > 0)
  : walkFiles(root);

let failed = false;
const secretPattern =
  /sk-[A-Za-z0-9_-]{20,}|tp-[a-z0-9]{30,}|[0-9a-f]{32}\.[A-Za-z0-9]{16}/u;

const readText = (file) => {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    return null;
  }
};

for (const file of files) {
  const abs = join(root, file);
  if (!existsSync(abs) || !statSync(abs).isFile()) continue;
  const text = readText(file);
  if (text === null) continue;
  const lines = text.split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (secretPattern.test(line)) {
      console.log(`  ✗ suspected key  ${file}:${String(index + 1)}:${line}`);
      failed = true;
    }
  });
}

const keyLine = /^[ \t]*key[ \t]*=/u;
for (const file of files) {
  if (!file.includes("provider.config")) continue;
  const text = readText(file);
  if (text === null) continue;
  const lines = text.split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (!keyLine.test(line)) return;
    const value = line
      .replace(/^[ \t]*key[ \t]*=[ \t]*"?/u, "")
      .replace(/"?[ \t]*$/u, "");
    if (value.length === 0 || (value.startsWith("<") && value.endsWith(">")))
      return;
    console.log(
      `  ✗ key not a placeholder  ${file}:${String(index + 1)}:${line}`,
    );
    failed = true;
  });
}

if (failed) {
  console.log("✗ scan-secrets: suspected key found, blocking.");
  process.exit(1);
}

console.log(`✓ scan-secrets: 0 hits (${String(files.length)} files)`);

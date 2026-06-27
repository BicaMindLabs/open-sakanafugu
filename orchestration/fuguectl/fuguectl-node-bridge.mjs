#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const bridgeDir = dirname(fileURLToPath(import.meta.url));
const repoRootPointer = join(bridgeDir, ".fugunano-repo-root");

const pointedRepoRoot = () => {
  if (!existsSync(repoRootPointer)) return null;
  const value = readFileSync(repoRootPointer, "utf8").trim();
  return value.length > 0 ? resolve(value) : null;
};

export const repoRoot = () =>
  process.env.FUGUNANO_REPO ??
  process.env.FUGUE_REPO ??
  pointedRepoRoot() ??
  resolve(bridgeDir, "..", "..");

export const engineCli = () =>
  process.env.FUGUE_ENGINE_CLI ??
  resolve(repoRoot(), "engine", "dist", "cli", "main.js");

export const die = (message) => {
  console.error(message);
  process.exit(2);
};

export const runEngine = (args) => {
  const cli = engineCli();
  if (!existsSync(cli)) {
    die(
      `fuguectl: engine CLI not built at ${cli} (run: cd ${repoRoot()}/engine && npm run build)`,
    );
  }
  const result = spawnSync(process.execPath, [cli, ...args], {
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
};

export const printHelp = (help) => console.log(help.trimEnd());

export const runSubcommandBridge = ({
  argv,
  command,
  allowed,
  help,
  unknown,
}) => {
  const [subcommand = "", ...rest] = argv;
  if (subcommand === "" || subcommand === "-h" || subcommand === "--help") {
    printHelp(help);
    return;
  }
  if (!allowed.includes(subcommand)) {
    die(unknown(subcommand));
  }
  runEngine([command, subcommand, ...rest]);
};

export const runSimpleBridge = ({
  argv,
  command,
  help,
  helpOnEmpty = true,
}) => {
  const [first = ""] = argv;
  if ((helpOnEmpty && first === "") || first === "-h" || first === "--help") {
    printHelp(help);
    return;
  }
  runEngine([command, ...argv]);
};

export const runAlwaysBridge = ({ argv, command }) => {
  runEngine([command, ...argv]);
};

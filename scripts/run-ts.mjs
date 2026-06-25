#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [script, ...args] = process.argv.slice(2);
if (script === undefined) {
  console.error("usage: node scripts/run-ts.mjs <script.ts> [args...]");
  process.exit(2);
}

const scriptPath = resolve(script);
process.argv = [process.execPath, scriptPath, ...args];

const source = await readFile(scriptPath, "utf8");
const url = `data:text/javascript;base64,${Buffer.from(
  `${source}\n//# sourceURL=${pathToFileURL(scriptPath).href}\n`,
).toString("base64")}`;

await import(url);

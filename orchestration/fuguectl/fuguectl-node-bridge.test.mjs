#!/usr/bin/env node
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createSuite, here } from "./fuguectl-testlib.mjs";

const suite = createSuite("fuguectl-node-bridge");
const tmp = mkdtempSync(join(tmpdir(), "fugue-bridge-"));
const bridge = join(tmp, "fuguectl-node-bridge.mjs");

copyFileSync(join(here, "fuguectl-node-bridge.mjs"), bridge);
writeFileSync(join(tmp, ".fugunano-repo-root"), "/tmp/fugunano-repo\n", "utf8");

const moduleUrl = `${pathToFileURL(bridge).href}?case=${Date.now()}`;
const bridgeModule = await import(moduleUrl);

suite.ok(
  "repoRoot reads installed skill repo pointer",
  () => bridgeModule.repoRoot() === resolve("/tmp/fugunano-repo"),
);

process.env.FUGUNANO_REPO = "/tmp/fugunano-env";
suite.ok(
  "FUGUNANO_REPO overrides installed repo pointer",
  () => bridgeModule.repoRoot() === resolve("/tmp/fugunano-env"),
);
delete process.env.FUGUNANO_REPO;

rmSync(tmp, { recursive: true, force: true });
suite.done();

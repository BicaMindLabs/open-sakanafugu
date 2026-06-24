import { createHash } from 'node:crypto';

import { BetaBernoulliAllocator } from '../adapters/allocation/beta-bernoulli-allocator.js';
import { PersistentBarrier } from '../adapters/barrier/persistent-barrier.js';
import { CcbHarness } from '../adapters/harness/ccb-harness.js';
import { CodexHarness } from '../adapters/harness/codex-harness.js';
import { OpencodeHarness } from '../adapters/harness/opencode-harness.js';
import { FsResultStore } from '../adapters/store/fs-result-store.js';
import { FsRunStore } from '../adapters/store/fs-run-store.js';
import { joinPath } from '../adapters/store/paths.js';
import { DEFAULT_ALLOCATION_PARAMS, type BenchTable } from '../domain/allocation.js';
import { DEFAULT_POLICIES } from '../domain/policy-eval.js';
import type { Harness, HarnessName } from '../domain/ports/harness.js';
import { systemClock } from '../infra/clock.js';
import type { CommandRunner } from '../infra/command-runner.js';
import { NodeCommandRunner } from '../infra/node-command-runner.js';
import { NodeFileSystem } from '../infra/node-file-system.js';
import { systemRng } from '../infra/rng.js';
import { Coordinator, type CoordinatorDeps } from './coordinator.js';

export interface WireConfig {
  /** Root dir for the engine's durable state (allocation/barrier/results/runs). */
  readonly stateDir: string;
  /** Which dispatch harness to use (default ccb). */
  readonly harness?: HarnessName;
  /** Allocation bench prior (default: empty → unlisted prior for everyone). */
  readonly bench?: BenchTable;
  /** Working directory for harness commands. */
  readonly cwd?: string;
}

const buildHarness = (name: HarnessName, runner: CommandRunner, cwd?: string): Harness => {
  const options = cwd !== undefined ? { cwd } : {};
  switch (name) {
    case 'ccb':
      return new CcbHarness(runner, options);
    case 'codex':
      return new CodexHarness(runner, options);
    case 'opencode':
      return new OpencodeHarness(runner, options);
  }
};

/**
 * The single composition root: assemble a Coordinator from the real
 * filesystem/CLI adapters. Nothing else in the codebase `new`s an adapter.
 */
export const wireCoordinator = (config: WireConfig): Coordinator => {
  const fs = new NodeFileSystem();
  const runner = new NodeCommandRunner();
  const deps: CoordinatorDeps = {
    policies: DEFAULT_POLICIES,
    allocator: new BetaBernoulliAllocator(
      fs,
      joinPath(config.stateDir, 'allocation'),
      config.bench ?? new Map(),
      {
        params: DEFAULT_ALLOCATION_PARAMS,
        rng: systemRng,
      },
    ),
    harness: buildHarness(config.harness ?? 'ccb', runner, config.cwd),
    barrier: new PersistentBarrier(fs, joinPath(config.stateDir, 'barrier')),
    resultStore: new FsResultStore(fs, joinPath(config.stateDir, 'results')),
    runStore: new FsRunStore(fs, joinPath(config.stateDir, 'runs')),
    clock: systemClock,
    hash: (content) => createHash('sha256').update(content).digest('hex'),
  };
  return new Coordinator(deps);
};

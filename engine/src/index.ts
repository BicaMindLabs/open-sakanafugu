/**
 * @bicamindlabs/fugue-engine — public surface.
 *
 * The typed multi-agent orchestration engine (ports & adapters). During the
 * bash → TS migration this barrel grows capability by capability; see
 * docs/ARCHITECTURE.md and docs/PARITY.md.
 */
export const VERSION = '0.0.0';

export type { Result, Ok, Err } from './domain/result.js';
export { ok, err, isOk, isErr, mapOk, unwrapOr } from './domain/result.js';

// Domain — value objects
export type { TaskState, TerminalState } from './domain/task.js';
export { TERMINAL_STATES, isTerminal } from './domain/task.js';
export type { Artifact, ArtifactKind } from './domain/artifact.js';
export type { Deadline, RoundManifest } from './domain/round.js';
export { stateOf, isComplete, pendingKeys, tally } from './domain/round.js';
export type { PhaseName, RunEvent, Run } from './domain/run.js';

// Domain — ports
export type { ResultStore } from './domain/ports/result-store.js';
export type { Barrier } from './domain/ports/barrier.js';
export type { RunStore, RunPatch } from './domain/ports/run-store.js';

// Infra — injected IO
export type { Clock } from './infra/clock.js';
export { systemClock } from './infra/clock.js';
export type { FileSystem } from './infra/file-system.js';
export { NodeFileSystem } from './infra/node-file-system.js';
export { MemoryFileSystem } from './infra/memory-file-system.js';

// Adapters
export { InMemoryResultStore } from './adapters/store/in-memory-result-store.js';
export { FsResultStore } from './adapters/store/fs-result-store.js';
export { InMemoryRunStore } from './adapters/store/in-memory-run-store.js';
export { FsRunStore } from './adapters/store/fs-run-store.js';
export { PersistentBarrier } from './adapters/barrier/persistent-barrier.js';

// App helpers
export { waitForRound } from './app/wait-for-round.js';

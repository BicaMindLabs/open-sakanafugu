import type { Barrier } from '../../domain/ports/barrier.js';
import type { RoundManifest } from '../../domain/round.js';
import { pendingKeys } from '../../domain/round.js';
import type { TaskState } from '../../domain/task.js';
import type { FileSystem } from '../../infra/file-system.js';
import { joinPath } from '../store/paths.js';
import { Mutex } from '../store/mutex.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTaskState = (value: unknown): value is TaskState => {
  switch (value) {
    case 'pending':
    case 'done':
    case 'fail':
    case 'timeout':
    case 'canceled':
      return true;
    default:
      return false;
  }
};

const emptyStates = (): Record<string, TaskState> =>
  Object.create(null) as Record<string, TaskState>;

const copyStates = (states: Readonly<Record<string, TaskState>>): Record<string, TaskState> => {
  const copy = emptyStates();
  for (const [key, state] of Object.entries(states)) copy[key] = state;
  return copy;
};

const isRoundManifest = (value: unknown): value is RoundManifest => {
  if (!isRecord(value)) return false;
  if (typeof value.round !== 'number' || !Number.isInteger(value.round)) return false;
  if (!Array.isArray(value.expected) || !value.expected.every((key) => typeof key === 'string'))
    return false;
  if (!isRecord(value.states)) return false;
  return Object.values(value.states).every(isTaskState);
};

const parseRoundManifest = (content: string, path: string): RoundManifest => {
  const parsed = JSON.parse(content) as unknown;
  if (!isRoundManifest(parsed)) throw new Error(`Invalid round manifest at ${path}`);
  return {
    round: parsed.round,
    expected: [...parsed.expected],
    states: copyStates(parsed.states),
  };
};

const sameExpected = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, i) => key === b[i]);

export class PersistentBarrier implements Barrier {
  // Serializes the load-mutate-save trio so concurrent marks can't lose an update.
  private readonly mutex = new Mutex();

  constructor(
    private readonly fs: FileSystem,
    private readonly rootDir: string,
  ) {}

  open(round: number, expected: readonly string[]): Promise<void> {
    return this.mutex.run(async () => {
      const existing = await this.load(round);
      if (existing !== null) {
        // Idempotent for the same expected set; never silently drop a dispatched key.
        if (!sameExpected(existing.expected, expected)) {
          throw new Error(`Round ${round} already opened with a different expected set`);
        }
        return;
      }
      await this.save({ round, expected: [...expected], states: emptyStates() });
    });
  }

  mark(round: number, key: string, state: TaskState): Promise<void> {
    return this.mutex.run(async () => {
      const manifest = await this.require(round);
      const states = copyStates(manifest.states);
      states[key] = state;
      await this.save({ ...manifest, states });
    });
  }

  async inspect(round: number): Promise<RoundManifest | null> {
    return await this.load(round);
  }

  settle(round: number): Promise<RoundManifest> {
    return this.mutex.run(async () => {
      const manifest = await this.require(round);
      const pending = pendingKeys(manifest);
      if (pending.length === 0) return manifest;

      const states = copyStates(manifest.states);
      for (const key of pending) states[key] = 'timeout';

      const settled: RoundManifest = { ...manifest, states };
      await this.save(settled);
      return settled;
    });
  }

  private pathForRound(round: number): string {
    return joinPath(this.rootDir, `round-${round}.json`);
  }

  private async load(round: number): Promise<RoundManifest | null> {
    const path = this.pathForRound(round);
    const content = await this.fs.read(path);
    if (content === null) return null;
    return parseRoundManifest(content, path);
  }

  private async require(round: number): Promise<RoundManifest> {
    const manifest = await this.load(round);
    if (manifest === null) throw new Error(`Round ${round} was never opened`);
    return manifest;
  }

  private async save(manifest: RoundManifest): Promise<void> {
    await this.fs.write(
      this.pathForRound(manifest.round),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }
}

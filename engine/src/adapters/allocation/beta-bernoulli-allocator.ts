import {
  DEFAULT_ALLOCATION_PARAMS,
  type AllocationOutcome,
  type AllocationParams,
  type BenchTable,
  type Ranking,
  type StatEntry,
  type StrategyState,
  type TaskProfile,
} from '../../domain/allocation.js';
import { applyOutcome, decayState, rankAgents } from '../../domain/allocation-score.js';
import type { AllocationStrategy, RankOptions } from '../../domain/ports/allocation-strategy.js';
import type { FileSystem } from '../../infra/file-system.js';
import { systemRng, type Rng } from '../../infra/rng.js';
import { Mutex } from '../store/mutex.js';
import { joinPath } from '../store/paths.js';

interface AllocatorOptions {
  readonly params?: AllocationParams;
  readonly rng?: Rng;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEvidenceCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isStatEntry = (value: unknown): value is StatEntry => {
  if (!isRecord(value)) return false;
  return (
    typeof value.taskType === 'string' &&
    typeof value.agent === 'string' &&
    isEvidenceCount(value.s) &&
    isEvidenceCount(value.f)
  );
};

const copyEntry = (entry: StatEntry): StatEntry => ({
  taskType: entry.taskType,
  agent: entry.agent,
  s: entry.s,
  f: entry.f,
});

const copyState = (state: StrategyState): StrategyState => state.map(copyEntry);

const parseState = (content: string, path: string): StrategyState => {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed) || !parsed.every(isStatEntry)) {
    throw new Error(`Invalid allocation stats at ${path}`);
  }
  return copyState(parsed);
};

export class BetaBernoulliAllocator implements AllocationStrategy {
  private readonly mutex = new Mutex();
  private readonly params: AllocationParams;
  private readonly rng: Rng;

  constructor(
    private readonly fs: FileSystem,
    private readonly rootDir: string,
    private readonly bench: BenchTable,
    opts: AllocatorOptions = {},
  ) {
    this.params = opts.params ?? DEFAULT_ALLOCATION_PARAMS;
    this.rng = opts.rng ?? systemRng;
  }

  async rank(profile: TaskProfile, options: RankOptions = {}): Promise<Ranking> {
    const state = await this.load();
    return rankAgents(profile.taskType, this.bench, state, this.params, {
      sample: options.sample ?? false,
      random: () => this.rng.next(),
    });
  }

  update(outcome: AllocationOutcome): Promise<void> {
    return this.mutex.run(async () => {
      const state = await this.load();
      await this.save(applyOutcome(state, outcome));
    });
  }

  async decay(gamma: number, taskType?: string): Promise<void> {
    // Guard the IO boundary: a non-finite, <=0 or >1 gamma would persist negative
    // counts or NaN/Infinity (which JSON-stringify to null and poison later loads).
    // `async` so this surfaces as a rejected promise, not a synchronous throw.
    if (!Number.isFinite(gamma) || gamma <= 0 || gamma > 1) {
      throw new Error(`decay gamma must be in (0, 1], got ${gamma}`);
    }
    await this.mutex.run(async () => {
      const state = await this.load();
      await this.save(decayState(state, gamma, taskType));
    });
  }

  async snapshot(): Promise<StrategyState> {
    return await this.load();
  }

  private path(): string {
    return joinPath(this.rootDir, 'stats.json');
  }

  private async load(): Promise<StrategyState> {
    const path = this.path();
    const content = await this.fs.read(path);
    if (content === null) return [];
    return parseState(content, path);
  }

  private async save(state: StrategyState): Promise<void> {
    await this.fs.write(this.path(), `${JSON.stringify(copyState(state), null, 2)}\n`);
  }
}

import type { RunStore, RunPatch } from '../../domain/ports/run-store.js';
import type { PhaseName, Run, RunEvent } from '../../domain/run.js';
import type { FileSystem } from '../../infra/file-system.js';
import { fileKey, joinPath } from './paths.js';
import { Mutex } from './mutex.js';

const hasOwnBest = (patch: RunPatch): boolean =>
  Object.prototype.hasOwnProperty.call(patch, 'best');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPhaseName = (value: unknown): value is PhaseName => {
  switch (value) {
    case 'plan':
    case 'dispatch':
    case 'integrate':
    case 'review':
    case 'loop':
      return true;
    default:
      return false;
  }
};

const isRunEvent = (value: unknown): value is RunEvent => {
  if (!isRecord(value)) return false;
  if (typeof value.at !== 'number' || !isPhaseName(value.phase) || typeof value.kind !== 'string')
    return false;
  return value.detail === undefined || typeof value.detail === 'string';
};

const isRun = (value: unknown): value is Run => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !isPhaseName(value.phase) || typeof value.round !== 'number')
    return false;
  if (!Array.isArray(value.events) || !value.events.every(isRunEvent)) return false;
  return value.best === undefined || typeof value.best === 'string';
};

const snapshot = (run: Run): Run => {
  const base = {
    id: run.id,
    phase: run.phase,
    round: run.round,
    events: [...run.events],
  };

  return run.best === undefined ? base : { ...base, best: run.best };
};

const evolve = (run: Run, patch: RunPatch): Run => {
  const base = {
    id: run.id,
    phase: patch.phase ?? run.phase,
    round: patch.round ?? run.round,
    events: [...run.events],
  };

  if (hasOwnBest(patch)) return patch.best === undefined ? base : { ...base, best: patch.best };
  return run.best === undefined ? base : { ...base, best: run.best };
};

const parseRun = (content: string, path: string): Run => {
  const parsed = JSON.parse(content) as unknown;
  if (!isRun(parsed)) throw new Error(`Invalid run record at ${path}`);
  return snapshot(parsed);
};

export class FsRunStore implements RunStore {
  // Serializes load-mutate-save so concurrent patch/appendEvent can't lose an update.
  private readonly mutex = new Mutex();

  constructor(
    private readonly fs: FileSystem,
    private readonly rootDir: string,
  ) {}

  create(id: string, phase: PhaseName): Promise<Run> {
    return this.mutex.run(async () => {
      const run: Run = { id, phase, round: 0, events: [] };
      await this.save(run);
      return snapshot(run);
    });
  }

  async get(id: string): Promise<Run | null> {
    return await this.load(id);
  }

  patch(id: string, patch: RunPatch): Promise<Run> {
    return this.mutex.run(async () => {
      const current = await this.require(id);
      const next = evolve(current, patch);
      await this.save(next);
      return snapshot(next);
    });
  }

  appendEvent(id: string, event: RunEvent): Promise<Run> {
    return this.mutex.run(async () => {
      const current = await this.require(id);
      const next = snapshot({ ...current, events: [...current.events, event] });
      await this.save(next);
      return snapshot(next);
    });
  }

  private pathForId(id: string): string {
    return joinPath(this.rootDir, fileKey(id));
  }

  private async load(id: string): Promise<Run | null> {
    const path = this.pathForId(id);
    const content = await this.fs.read(path);
    if (content === null) return null;
    return parseRun(content, path);
  }

  private async require(id: string): Promise<Run> {
    const run = await this.load(id);
    if (run === null) throw new Error(`Run ${id} does not exist`);
    return run;
  }

  private async save(run: Run): Promise<void> {
    await this.fs.write(this.pathForId(run.id), `${JSON.stringify(run, null, 2)}\n`);
  }
}

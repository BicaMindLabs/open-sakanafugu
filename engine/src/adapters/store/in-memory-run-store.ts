import type { RunStore, RunPatch } from '../../domain/ports/run-store.js';
import type { PhaseName, Run, RunEvent } from '../../domain/run.js';

const hasOwnBest = (patch: RunPatch): boolean =>
  Object.prototype.hasOwnProperty.call(patch, 'best');

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

export class InMemoryRunStore implements RunStore {
  readonly #runs = new Map<string, Run>();

  create(id: string, phase: PhaseName): Promise<Run> {
    const run: Run = { id, phase, round: 0, events: [] };
    this.#runs.set(id, run);
    return Promise.resolve(snapshot(run));
  }

  get(id: string): Promise<Run | null> {
    const run = this.#runs.get(id);
    return Promise.resolve(run === undefined ? null : snapshot(run));
  }

  patch(id: string, patch: RunPatch): Promise<Run> {
    const current = this.#runs.get(id);
    if (current === undefined) return Promise.reject(new Error(`Run ${id} does not exist`));

    const next = evolve(current, patch);
    this.#runs.set(id, next);
    return Promise.resolve(snapshot(next));
  }

  appendEvent(id: string, event: RunEvent): Promise<Run> {
    const current = this.#runs.get(id);
    if (current === undefined) return Promise.reject(new Error(`Run ${id} does not exist`));

    const next = snapshot({ ...current, events: [...current.events, event] });
    this.#runs.set(id, next);
    return Promise.resolve(snapshot(next));
  }
}

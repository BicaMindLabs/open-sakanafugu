import type { PhaseName, Run, RunEvent } from '../run.js';

/** A sparse update to a run's scalar fields. Absent fields are left unchanged. */
export interface RunPatch {
  readonly phase?: PhaseName;
  readonly round?: number;
  readonly best?: string;
}

/**
 * Durable home of the cross-phase `Run` state (the `run` CLI facade). Returns
 * the evolved snapshot from every mutator so callers never read stale state.
 */
export interface RunStore {
  create(id: string, phase: PhaseName): Promise<Run>;
  get(id: string): Promise<Run | null>;
  patch(id: string, patch: RunPatch): Promise<Run>;
  appendEvent(id: string, event: RunEvent): Promise<Run>;
}

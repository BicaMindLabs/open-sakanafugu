export type PhaseName = 'plan' | 'dispatch' | 'integrate' | 'review' | 'loop';

/** An append-only record of something that happened during a run. */
export interface RunEvent {
  readonly at: number; // epoch millis (from an injected Clock)
  readonly phase: PhaseName;
  readonly kind: string;
  readonly detail?: string;
}

/**
 * The machine-readable cross-phase state of one orchestration run — the home of
 * the `run` CLI facade. Immutable snapshot; the store evolves it.
 */
export interface Run {
  readonly id: string;
  readonly phase: PhaseName;
  readonly round: number;
  readonly best?: string;
  readonly events: readonly RunEvent[];
}

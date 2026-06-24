import type { AllocationOutcome, Ranking, StrategyState, TaskProfile } from '../allocation.js';

/** Ranking mode: greedy posterior mean (default, deterministic) vs Thompson Sampling (explores). */
export interface RankOptions {
  readonly sample?: boolean;
}

/**
 * The learning router: rank candidates for a task (bench prior + posterior),
 * feed verdicts back, and forget stale evidence after a model upgrade. The
 * scoring itself is a pure function (see domain/allocation-score); this port
 * adds persistence of the posterior. Training-free.
 */
export interface AllocationStrategy {
  /** Ranked candidates (bench-listed ∪ those with evidence) for the profile. */
  rank(profile: TaskProfile, options?: RankOptions): Promise<Ranking>;
  /** Record one real-world outcome into the posterior. */
  update(outcome: AllocationOutcome): Promise<void>;
  /** Discount forgetting: multiply s,f by gamma (<1) — non-stationary bandit, after a model upgrade. */
  decay(gamma: number, taskType?: string): Promise<void>;
  /** The full persisted posterior. */
  snapshot(): Promise<StrategyState>;
}

/**
 * Adaptive routing — the training-free analogue of Fugu's learned coordinator.
 *
 * A static bench table is the Beta prior; real-world win/loss does the posterior
 * update (Beta-Bernoulli). Cold start (no evidence) ranks exactly by bench;
 * routing only drifts once enough outcomes accumulate. See docs/ARCHITECTURE.md.
 */

/** What to route: the task type (+ optional tags for future contextual routing). */
export interface TaskProfile {
  readonly taskType: string;
  readonly tags?: readonly string[];
}

/** One real-world result fed back into the posterior. */
export interface AllocationOutcome {
  readonly taskType: string;
  readonly agent: string;
  readonly result: 'ok' | 'fail';
}

/** Static bench prior: per task type, agents in preference order (index 0 = best). */
export type BenchTable = ReadonlyMap<string, readonly string[]>;

/** Persistable posterior evidence — one row per (task type, agent). */
export interface StatEntry {
  readonly taskType: string;
  readonly agent: string;
  readonly s: number; // successes
  readonly f: number; // failures
}
export type StrategyState = readonly StatEntry[];

/** One ranked candidate. */
export interface RankedAgent {
  readonly agent: string;
  readonly score: number;
  /** 1-based bench position, or `UNLISTED_RANK` if the agent is not in the bench list. */
  readonly benchRank: number;
}
export type Ranking = readonly RankedAgent[];

/** Tunables for the Beta-Bernoulli scoring. */
export interface AllocationParams {
  /** Prior strength: how many real samples it takes to override the bench (bash default 4). */
  readonly kappa: number;
  /** Prior win-rate for an agent absent from the bench list (bash default 0.15). */
  readonly unlistedPrior: number;
}

export const DEFAULT_ALLOCATION_PARAMS: AllocationParams = { kappa: 4, unlistedPrior: 0.15 };

/** benchRank for an agent that has evidence but no bench listing (sorts last). */
export const UNLISTED_RANK = Number.MAX_SAFE_INTEGER;

/**
 * Eval benchmark-runner domain types + pure aggregators.
 *
 * Case C: `aggregateResults` and `formatMetricsTable` are STUBS — implement them
 * (see CONTRACT.md and eval.test.ts). Types are frozen.
 */
export type EvalMode = 'orchestrated' | 'single';

export interface EvalTask {
  readonly id: string;
  readonly prompt: string;
  /** Shell gate command; the task is "resolved" iff it exits 0. */
  readonly gate: string;
  readonly workdir: string;
}

export interface EvalSuite {
  readonly tasks: readonly EvalTask[];
  readonly modes: readonly EvalMode[];
}

export interface EvalRunResult {
  readonly taskId: string;
  readonly mode: EvalMode;
  readonly resolved: boolean;
  readonly rounds: number;
  readonly wallMs: number;
  readonly tokens: number;
}

export interface EvalModeMetrics {
  readonly mode: EvalMode;
  /** Fraction of tasks resolved, 0..1. */
  readonly resolvedRate: number;
  readonly avgRounds: number;
  readonly avgWallMs: number;
  readonly totalTokens: number;
  readonly resolved: number;
  readonly total: number;
}

export interface EvalMetrics {
  readonly perMode: readonly EvalModeMetrics[];
  /**
   * Higher resolvedRate wins; ties broken by fewer avgRounds, then fewer totalTokens;
   * still tied (or no results) => null.
   */
  readonly winner: EvalMode | null;
}

/** Aggregate raw run results into per-mode metrics. Pure. IMPLEMENT ME (Case C). */
export const aggregateResults = (
  results: readonly EvalRunResult[],
  modes: readonly EvalMode[],
): EvalMetrics => {
  void results;
  void modes;
  throw new Error('aggregateResults: not implemented (Case C)');
};

/** Render metrics as a fixed-width human-readable table. Pure. IMPLEMENT ME (Case C). */
export const formatMetricsTable = (metrics: EvalMetrics): string => {
  void metrics;
  throw new Error('formatMetricsTable: not implemented (Case C)');
};

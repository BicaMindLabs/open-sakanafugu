/**
 * Run policies — the hard rules ("generation ≠ review", retired CLI guards) as
 * first-class objects evaluated against the chosen agents, not conventions.
 */

/** The agents/harness chosen for a run; what policies are evaluated against. */
export interface Selection {
  readonly implementers: readonly string[];
  readonly reviewer?: string;
  readonly harness?: string;
}

export interface PolicyViolation {
  readonly policy: string;
  readonly severity: 'fail' | 'warn';
  readonly detail: string;
}

export interface PolicyResult {
  readonly violations: readonly PolicyViolation[];
}

/** A pure rule over a Selection. */
export interface Policy {
  readonly id: string;
  evaluate(selection: Selection): readonly PolicyViolation[];
}

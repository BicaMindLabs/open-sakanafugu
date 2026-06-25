/** A git committer identity (explicit, so integration works with no global git config). */
export interface Identity {
  readonly name: string;
  readonly email: string;
}

/** One agent's worktree to integrate. */
export interface Worktree {
  readonly agent: string;
  readonly path: string;
}

export type VcsErrorKind = 'no-commit' | 'conflict' | 'git-error';
export interface VcsError {
  readonly kind: VcsErrorKind;
  readonly detail: string;
}

/** How one agent's integration ended. */
export type IntegrationOutcome = 'picked' | 'nochange' | 'conflict' | 'violation' | 'error';

export interface AgentIntegration {
  readonly agent: string;
  readonly outcome: IntegrationOutcome;
  readonly detail: string;
  readonly commitSha?: string;
  readonly changedFiles?: readonly string[];
  readonly violatingFiles?: readonly string[];
}

export interface IntegrationReport {
  readonly results: readonly AgentIntegration[];
}

/** True iff every agent landed cleanly (picked or nothing to do). */
export const allClean = (report: IntegrationReport): boolean =>
  report.results.every((r) => r.outcome === 'picked' || r.outcome === 'nochange');

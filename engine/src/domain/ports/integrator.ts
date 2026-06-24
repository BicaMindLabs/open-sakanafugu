import type { Ownership } from '../ownership.js';
import type { IntegrationReport, Worktree } from '../vcs.js';

export interface IntegrateOptions {
  readonly ownership?: Ownership;
  /** Commit message prefix per agent (the agent name is appended). */
  readonly messagePrefix?: string;
}

/**
 * Phase 3: cherry-pick each agent's worktree onto the main repo, isolating
 * failures — an ownership violation or a conflict stops that one agent only;
 * the rest still land. Returns a per-agent report.
 */
export interface Integrator {
  integrate(
    repo: string,
    worktrees: readonly Worktree[],
    options?: IntegrateOptions,
  ): Promise<IntegrationReport>;
}

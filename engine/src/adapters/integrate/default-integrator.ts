import { checkOwnership } from '../../domain/ownership-check.js';
import type { IntegrateOptions, Integrator } from '../../domain/ports/integrator.js';
import type { VcsPort } from '../../domain/ports/vcs.js';
import { isErr } from '../../domain/result.js';
import type { AgentIntegration, Identity, IntegrationReport, Worktree } from '../../domain/vcs.js';

/**
 * Cherry-picks each worktree onto the repo, isolating failures: an ownership
 * violation or a conflict stops only that agent; the rest still integrate.
 */
export class DefaultIntegrator implements Integrator {
  constructor(
    private readonly vcs: VcsPort,
    private readonly identity: Identity,
  ) {}

  async integrate(
    repo: string,
    worktrees: readonly Worktree[],
    options: IntegrateOptions = {},
  ): Promise<IntegrationReport> {
    const { ownership } = options;
    const prefix = options.messagePrefix ?? 'fuguectl: integrate';
    const abortOnConflict = options.onConflict !== 'skip';
    const results: AgentIntegration[] = [];

    for (const wt of worktrees) {
      const changedFiles = await this.vcs.changedFiles(wt.path);
      // 1) ownership (on the still-uncommitted change set, before we commit it)
      if (ownership !== undefined) {
        const bad = checkOwnership(ownership, wt.agent, changedFiles);
        if (bad.length > 0) {
          results.push({
            agent: wt.agent,
            outcome: 'violation',
            detail: `out-of-bounds: ${bad.join(' ')}`,
            changedFiles,
            violatingFiles: bad,
          });
          continue;
        }
      }

      // 2) commit the worktree as the orchestrator identity
      const committed = await this.vcs.commitAll(wt.path, this.identity, `${prefix} ${wt.agent}`);
      if (isErr(committed)) {
        results.push(
          committed.error.kind === 'no-commit'
            ? { agent: wt.agent, outcome: 'nochange', detail: 'no changes to integrate' }
            : {
                agent: wt.agent,
                outcome: 'error',
                detail: committed.error.detail,
                changedFiles,
              },
        );
        continue;
      }

      // 3) cherry-pick onto main; a conflict is aborted and isolated
      const picked = await this.vcs.cherryPick(repo, committed.value, this.identity, {
        abortOnConflict,
      });
      results.push(
        isErr(picked)
          ? {
              agent: wt.agent,
              outcome: picked.error.kind === 'conflict' ? 'conflict' : 'error',
              detail: picked.error.detail,
              commitSha: committed.value,
              changedFiles,
            }
          : {
              agent: wt.agent,
              outcome: 'picked',
              detail: committed.value,
              commitSha: committed.value,
              changedFiles,
            },
      );
    }

    return { results };
  }
}

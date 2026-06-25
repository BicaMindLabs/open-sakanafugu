import type { Identity, VcsError } from '../vcs.js';
import type { Result } from '../result.js';

/**
 * The git operations integration needs, behind a port (real impl shells out via
 * a CommandRunner; tests use a fake). Each call targets a repo/worktree by path.
 */
export interface VcsPort {
  /** Paths changed in the worktree (staged + unstaged + untracked), relative to the worktree. */
  changedFiles(worktree: string): Promise<readonly string[]>;
  /**
   * Stage everything and commit as `identity`; resolves with the new commit sha,
   * or a `no-commit` error if the worktree had nothing to commit.
   */
  commitAll(
    worktree: string,
    identity: Identity,
    message: string,
  ): Promise<Result<string, VcsError>>;
  /**
   * Cherry-pick `sha` onto the repo's current branch as `identity`. On conflict,
   * aborts by default (leaving the repo clean) and resolves with a `conflict` error.
   */
  cherryPick(
    repo: string,
    sha: string,
    identity: Identity,
    options?: { readonly abortOnConflict?: boolean },
  ): Promise<Result<void, VcsError>>;
}

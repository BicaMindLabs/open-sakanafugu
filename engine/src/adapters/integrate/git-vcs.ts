import type { VcsPort } from '../../domain/ports/vcs.js';
import type { Identity, VcsError } from '../../domain/vcs.js';
import { err, ok } from '../../domain/result.js';
import type { Result } from '../../domain/result.js';
import type { CommandRunner } from '../../infra/command-runner.js';

/** `git status --porcelain` line → the path (the new path for renames). */
const porcelainPath = (line: string): string => {
  const rest = line.slice(3); // drop the 2-char status + space
  const arrow = rest.indexOf(' -> ');
  return arrow !== -1 ? rest.slice(arrow + 4) : rest;
};

/** VcsPort backed by the real `git` CLI (via an injected CommandRunner). */
export class GitVcsPort implements VcsPort {
  constructor(
    private readonly runner: CommandRunner,
    private readonly bin = 'git',
  ) {}

  private run(cwd: string, args: readonly string[], identity?: Identity) {
    const idFlags = identity
      ? ['-c', `user.name=${identity.name}`, '-c', `user.email=${identity.email}`]
      : [];
    return this.runner.run(this.bin, ['-C', cwd, ...idFlags, ...args]);
  }

  async changedFiles(worktree: string): Promise<readonly string[]> {
    const result = await this.run(worktree, ['status', '--porcelain']);
    return result.stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map(porcelainPath);
  }

  async commitAll(
    worktree: string,
    identity: Identity,
    message: string,
  ): Promise<Result<string, VcsError>> {
    await this.run(worktree, ['add', '-A']);
    const staged = await this.run(worktree, ['diff', '--cached', '--quiet']);
    if (staged.code === 0) return err({ kind: 'no-commit', detail: 'nothing to commit' });

    const commit = await this.run(worktree, ['commit', '-m', message], identity);
    if (commit.code !== 0)
      return err({ kind: 'git-error', detail: commit.stderr || commit.stdout });

    const head = await this.run(worktree, ['rev-parse', 'HEAD']);
    if (head.code !== 0) return err({ kind: 'git-error', detail: head.stderr || head.stdout });
    return ok(head.stdout.trim());
  }

  async cherryPick(repo: string, sha: string, identity: Identity): Promise<Result<void, VcsError>> {
    const picked = await this.run(repo, ['cherry-pick', sha], identity);
    if (picked.code === 0) return ok(undefined);
    await this.run(repo, ['cherry-pick', '--abort']); // isolate: keep the repo clean
    return err({ kind: 'conflict', detail: picked.stderr || picked.stdout });
  }
}

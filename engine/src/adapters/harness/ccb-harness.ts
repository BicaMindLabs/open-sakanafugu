import type {
  DispatchError,
  DispatchRequest,
  DispatchResult,
  HealthStatus,
} from '../../domain/dispatch.js';
import type { Harness } from '../../domain/ports/harness.js';
import type { Result } from '../../domain/result.js';
import type { CommandOptions, CommandRunner } from '../../infra/command-runner.js';
import { runDispatch, type HarnessExecOptions } from './exec-helpers.js';

/** Ready iff `ccb ping ccbd` reports an actually-mounted ccbd (not merely alive). */
const MOUNTED = /^mount_state:\s*mounted/mu;

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Dispatch via a Claude Code cc-* clone: `ccb ask <agent> --compact` (prompt on stdin). */
export class CcbHarness implements Harness {
  readonly name = 'ccb';
  private readonly bin: string;
  private readonly cwd?: string;

  constructor(
    private readonly runner: CommandRunner,
    options: HarnessExecOptions = {},
  ) {
    this.bin = options.bin ?? 'ccb';
    if (options.cwd !== undefined) this.cwd = options.cwd;
  }

  private options(): CommandOptions {
    return this.cwd !== undefined ? { cwd: this.cwd } : {};
  }

  dispatch(request: DispatchRequest): Promise<Result<DispatchResult, DispatchError>> {
    return runDispatch(this.runner, this.bin, ['ask', request.agent, '--compact'], request, {
      stdin: `${request.prompt}\n`,
      ...this.options(),
    });
  }

  async health(): Promise<HealthStatus> {
    try {
      const result = await this.runner.run(this.bin, ['ping', 'ccbd'], this.options());
      // bash is_ready runs under pipefail: a nonzero `ccb ping` fails even if stdout
      // happens to contain `mount_state: mounted`. Require both.
      if (result.code === 0 && MOUNTED.test(result.stdout)) {
        return { healthy: true, detail: 'ccbd mounted' };
      }
      const seen = result.stdout.trim() || result.stderr.trim() || 'no response';
      return { healthy: false, detail: `ccbd not mounted (exit ${result.code}): ${seen}` };
    } catch (error) {
      return { healthy: false, detail: message(error) };
    }
  }
}

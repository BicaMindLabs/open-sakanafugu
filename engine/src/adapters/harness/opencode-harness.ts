import type {
  DispatchError,
  DispatchRequest,
  DispatchResult,
  HealthStatus,
} from '../../domain/dispatch.js';
import type { Harness } from '../../domain/ports/harness.js';
import type { Result } from '../../domain/result.js';
import type { CommandOptions, CommandRunner } from '../../infra/command-runner.js';
import { runDispatch, versionHealth, type HarnessExecOptions } from './exec-helpers.js';

/** Dispatch via `opencode run -m <provider/model> <prompt>` (target = provider/model). */
export class OpencodeHarness implements Harness {
  readonly name = 'opencode';
  private readonly bin: string;
  private readonly commandOptions: CommandOptions;
  private readonly extraArgs: readonly string[];

  constructor(
    private readonly runner: CommandRunner,
    options: HarnessExecOptions = {},
  ) {
    this.bin = options.bin ?? 'opencode';
    this.extraArgs = options.args ?? [];
    this.commandOptions = {
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    };
  }

  private options(): CommandOptions {
    return this.commandOptions;
  }

  dispatch(request: DispatchRequest): Promise<Result<DispatchResult, DispatchError>> {
    return runDispatch(
      this.runner,
      this.bin,
      ['run', ...this.extraArgs, '-m', request.agent, request.prompt],
      request,
      this.options(),
    );
  }

  health(): Promise<HealthStatus> {
    return versionHealth(this.runner, this.bin, this.options());
  }
}

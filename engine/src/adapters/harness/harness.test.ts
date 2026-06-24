import { describe, expect, it } from 'vitest';

import { isErr, isOk } from '../../domain/result.js';
import type { CommandOptions, CommandResult, CommandRunner } from '../../infra/command-runner.js';
import { CcbHarness } from './ccb-harness.js';
import { CodexHarness } from './codex-harness.js';
import { OpencodeHarness } from './opencode-harness.js';

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: CommandOptions | undefined;
}

class FakeRunner implements CommandRunner {
  readonly calls: Call[] = [];
  constructor(
    private readonly result: CommandResult,
    private readonly shouldThrow = false,
  ) {}
  run(command: string, args: readonly string[], options?: CommandOptions): Promise<CommandResult> {
    this.calls.push({ command, args, options });
    if (this.shouldThrow) return Promise.reject(new Error('spawn ENOENT'));
    return Promise.resolve(this.result);
  }
}

const res = (over: Partial<CommandResult> = {}): CommandResult => ({
  code: 0,
  stdout: '',
  stderr: '',
  ...over,
});

describe('CcbHarness', () => {
  it('dispatch builds `ccb ask <agent> --compact` and pipes the prompt on stdin', async () => {
    const runner = new FakeRunner(res({ code: 0, stdout: 'done' }));
    const result = await new CcbHarness(runner).dispatch({ agent: 'cc-deepseek', prompt: 'hi' });

    expect(runner.calls[0]?.command).toBe('ccb');
    expect(runner.calls[0]?.args).toEqual(['ask', 'cc-deepseek', '--compact']);
    expect(runner.calls[0]?.options?.stdin).toBe('hi\n');
    expect(isOk(result) && result.value.output).toBe('done');
  });

  it('maps a nonzero exit to a nonzero-exit error', async () => {
    const runner = new FakeRunner(res({ code: 2, stderr: 'boom' }));
    const result = await new CcbHarness(runner).dispatch({ agent: 'cc-glm', prompt: 'x' });
    expect(isErr(result) && result.error.kind).toBe('nonzero-exit');
    expect(isErr(result) && result.error.exitCode).toBe(2);
  });

  it('maps a spawn failure to a spawn-failed error', async () => {
    const runner = new FakeRunner(res(), true);
    const result = await new CcbHarness(runner).dispatch({ agent: 'cc-kimi', prompt: 'x' });
    expect(isErr(result) && result.error.kind).toBe('spawn-failed');
  });

  it('health is ready only when ccbd reports mount_state: mounted', async () => {
    const mounted = await new CcbHarness(
      new FakeRunner(res({ stdout: 'mount_state: mounted\nhealth: alive' })),
    ).health();
    expect(mounted.healthy).toBe(true);

    const unmounted = await new CcbHarness(
      new FakeRunner(res({ stdout: 'mount_state: unmounted' })),
    ).health();
    expect(unmounted.healthy).toBe(false);
  });

  it('health requires `ccb ping` to exit 0 (pipefail parity), not just the mounted line', async () => {
    const result = await new CcbHarness(
      new FakeRunner(res({ code: 1, stdout: 'mount_state: mounted' })),
    ).health();
    expect(result.healthy).toBe(false);
  });
});

describe('CodexHarness', () => {
  it('dispatch builds `codex exec --model <model> <prompt>`', async () => {
    const runner = new FakeRunner(res({ stdout: 'ok' }));
    await new CodexHarness(runner).dispatch({ agent: 'gpt-5.5', prompt: 'review this' });
    expect(runner.calls[0]?.args).toEqual(['exec', '--model', 'gpt-5.5', 'review this']);
  });

  it('health uses --version exit code', async () => {
    expect((await new CodexHarness(new FakeRunner(res({ code: 0 }))).health()).healthy).toBe(true);
    expect((await new CodexHarness(new FakeRunner(res({ code: 1 }))).health()).healthy).toBe(false);
  });
});

describe('OpencodeHarness', () => {
  it('dispatch builds `opencode run -m <provider/model> <prompt>`', async () => {
    const runner = new FakeRunner(res());
    await new OpencodeHarness(runner).dispatch({ agent: 'volcengine/doubao', prompt: 'go' });
    expect(runner.calls[0]?.args).toEqual(['run', '-m', 'volcengine/doubao', 'go']);
  });
});

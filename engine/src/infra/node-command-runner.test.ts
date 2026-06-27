import { describe, expect, it } from 'vitest';

import { NodeCommandRunner } from './node-command-runner.js';

const node = process.execPath;

describe('NodeCommandRunner', () => {
  it('captures stdout and a zero exit code', async () => {
    const result = await new NodeCommandRunner().run(node, ['-e', 'process.stdout.write("hello")']);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('hello');
  });

  it('passes stdin to the child', async () => {
    const result = await new NodeCommandRunner().run(
      node,
      ['-e', 'process.stdin.on("data",d=>process.stdout.write(d)).on("end",()=>process.exit(0))'],
      { stdin: 'piped-in' },
    );
    expect(result.stdout).toBe('piped-in');
  });

  it('captures a nonzero exit code and stderr', async () => {
    const result = await new NodeCommandRunner().run(node, [
      '-e',
      'process.stderr.write("nope");process.exit(3)',
    ]);
    expect(result.code).toBe(3);
    expect(result.stderr).toBe('nope');
  });

  it('reports a nonzero code when the child is killed by a signal', async () => {
    const result = await new NodeCommandRunner().run(node, [
      '-e',
      'process.kill(process.pid, "SIGTERM")',
    ]);
    expect(result.code).not.toBe(0); // signal-kill must not look like success
  });

  it('returns a timeout result when a child exceeds timeoutMs', async () => {
    const started = Date.now();
    const result = await new NodeCommandRunner().run(
      node,
      ['-e', 'setTimeout(() => process.stdout.write("late"), 5000)'],
      { timeoutMs: 50 },
    );
    expect(result.code).toBe(124);
    expect(result.stderr).toContain('command timed out after 50ms');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('rejects when the binary does not exist', async () => {
    await expect(
      new NodeCommandRunner().run('definitely-not-a-real-binary-xyz', []),
    ).rejects.toBeInstanceOf(Error);
  });
});

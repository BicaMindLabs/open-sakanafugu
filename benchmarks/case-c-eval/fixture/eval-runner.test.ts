import { describe, expect, it } from 'vitest';

import { runEvalSuite } from './eval-runner.js';
import type { EvalDispatcher } from './eval-runner.js';
import type { EvalRunResult, EvalSuite } from '../../domain/eval.js';

const mkResult = (taskId: string, mode: 'orchestrated' | 'single'): EvalRunResult => ({
  taskId,
  mode,
  resolved: true,
  rounds: 1,
  wallMs: 10,
  tokens: 5,
});

const suite: EvalSuite = {
  tasks: [
    { id: 't1', prompt: 'p', gate: 'g', workdir: '.' },
    { id: 't2', prompt: 'p', gate: 'g', workdir: '.' },
  ],
  modes: ['orchestrated', 'single'],
};

const recordingDispatcher = (): {
  dispatcher: EvalDispatcher;
  calls: string[];
} => {
  const calls: string[] = [];
  return {
    calls,
    dispatcher: {
      run: (task, mode) => {
        calls.push(`${task.id}|${mode}`);
        return Promise.resolve(mkResult(task.id, mode));
      },
    },
  };
};

describe('runEvalSuite', () => {
  it('runs every task x mode combination (4 for 2 tasks x 2 modes)', async () => {
    const { dispatcher } = recordingDispatcher();
    const out = await runEvalSuite(suite, { dispatcher });
    expect(out).toHaveLength(4);
  });

  it('returns results in task-major, mode-minor order', async () => {
    const { dispatcher, calls } = recordingDispatcher();
    const out = await runEvalSuite(suite, { dispatcher });
    expect(calls).toEqual(['t1|orchestrated', 't1|single', 't2|orchestrated', 't2|single']);
    expect(out.map((r) => `${r.taskId}|${r.mode}`)).toEqual(calls);
  });

  it('handles a single mode', async () => {
    const { dispatcher } = recordingDispatcher();
    const out = await runEvalSuite({ tasks: suite.tasks, modes: ['single'] }, { dispatcher });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.mode === 'single')).toBe(true);
  });
});

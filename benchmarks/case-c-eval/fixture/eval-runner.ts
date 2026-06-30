/**
 * Eval suite runner: run every (task x mode) via an injected dispatcher and collect
 * raw results in deterministic order.
 *
 * Case C: `runEvalSuite` is a STUB — implement it (see CONTRACT.md and
 * eval-runner.test.ts). Types are frozen.
 */
import type { EvalMode, EvalRunResult, EvalSuite, EvalTask } from '../../domain/eval.js';

/** Runs one (task, mode) pair and returns its raw result. Injected for testing. */
export interface EvalDispatcher {
  run(task: EvalTask, mode: EvalMode): Promise<EvalRunResult>;
}

export interface EvalRunnerDeps {
  readonly dispatcher: EvalDispatcher;
}

/**
 * Run every task x mode combination via `deps.dispatcher` and return the raw results
 * in task-major, mode-minor order (for task t in suite.tasks, for mode m in suite.modes).
 * IMPLEMENT ME (Case C).
 */
export const runEvalSuite = (
  suite: EvalSuite,
  deps: EvalRunnerDeps,
): Promise<readonly EvalRunResult[]> => {
  void suite;
  void deps;
  return Promise.reject(new Error('runEvalSuite: not implemented (Case C)'));
};

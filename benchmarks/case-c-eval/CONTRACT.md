# Case C — Contract: implement the `eval` benchmark-runner module in FuguNano

> Mission: implement the `eval` module so `npm run check` (typecheck + lint + test) is green.
> The types and the **tests** are already written (they define acceptance). You fill in the
> implementations that currently `throw new Error('… not implemented (Case C)')`.

## What `eval` is for

A benchmark runner: given a suite of tasks × modes (`orchestrated` | `single`), run each
combination, collect raw results, and aggregate into per-mode metrics + a winner. This is
exactly the "orchestration vs single-model comparison" FuguNano needs.

## Files (types/tests are FROZEN — do not edit them; only edit the implementations)

| File | Status | You do |
|------|--------|--------|
| `engine/src/domain/eval.ts` | types ✓, `aggregateResults`/`formatMetricsTable` = stub | implement the two functions |
| `engine/src/domain/eval.test.ts` | ✓ frozen | (read it — it is your spec) |
| `engine/src/adapters/eval/eval-runner.ts` | types ✓, `runEvalSuite` = stub | implement it |
| `engine/src/adapters/eval/eval-runner.test.ts` | ✓ frozen | (read it — it is your spec) |
| `engine/src/cli/commands/eval.ts` | does not exist | create `EvalRunCommand` + register in `cli/cli.ts` (bonus, not gated) |

**Do not modify any `*.test.ts` file. Do not modify existing passing code.**

## Frozen signatures (domain/eval.ts)

```ts
export type EvalMode = 'orchestrated' | 'single';
export interface EvalTask { readonly id: string; readonly prompt: string; readonly gate: string; readonly workdir: string; }
export interface EvalSuite { readonly tasks: readonly EvalTask[]; readonly modes: readonly EvalMode[]; }
export interface EvalRunResult { readonly taskId: string; readonly mode: EvalMode; readonly resolved: boolean; readonly rounds: number; readonly wallMs: number; readonly tokens: number; }
export interface EvalModeMetrics { readonly mode: EvalMode; readonly resolvedRate: number; readonly avgRounds: number; readonly avgWallMs: number; readonly totalTokens: number; readonly resolved: number; readonly total: number; }
export interface EvalMetrics { readonly perMode: readonly EvalModeMetrics[]; readonly winner: EvalMode | null; }

aggregateResults(results: readonly EvalRunResult[], modes: readonly EvalMode[]): EvalMetrics
formatMetricsTable(metrics: EvalMetrics): string
```

## Frozen signatures (adapters/eval/eval-runner.ts)

```ts
interface EvalDispatcher { run(task: EvalTask, mode: EvalMode): Promise<EvalRunResult>; }
interface EvalRunnerDeps { readonly dispatcher: EvalDispatcher; }
runEvalSuite(suite: EvalSuite, deps: EvalRunnerDeps): Promise<readonly EvalRunResult[]>
```

## Semantics the tests enforce (read the tests for the exact contract)

- `aggregateResults`: per-mode resolvedRate = resolved/total; avgRounds/avgWallMs are means
  over that mode's results; totalTokens is a sum. A mode with zero results still appears
  (rate 0, averages 0). **winner** = higher resolvedRate; tie → fewer avgRounds; tie → fewer
  totalTokens; tie → null. No results at all → winner null.
- `formatMetricsTable`: a header row + one row per mode; contains the mode name and the word
  "resolved" (or the rate). Multi-line.
- `runEvalSuite`: runs **every** task×mode; results in **task-major, mode-minor** deterministic
  order; uses the injected `dispatcher` (no real subprocess).

## Acceptance gate

```bash
cd engine && npm run check   # typecheck + lint + vitest — MUST be fully green
```

Strict TS + ESLint apply (no `any`, `import type`, exhaustive). The 2 new test files must pass
and **none of the existing 545 tests may regress**.

You are implementing a real feature module in the **FuguNano** engine at the current
directory (`engine/src`). You are the whole team — no reviewer will catch your mistakes.

## Task
Implement the `eval` benchmark-runner module. The types and tests are ALREADY WRITTEN and
FROZEN; fill in the implementations that currently throw `not implemented (Case C)`:
1. `engine/src/domain/eval.ts` → `aggregateResults`, `formatMetricsTable`
2. `engine/src/adapters/eval/eval-runner.ts` → `runEvalSuite`
3. (bonus) `engine/src/cli/commands/eval.ts` + register in `engine/src/cli/cli.ts`

## Rules
- Edit files under `engine/src/` with Edit/Write. **Do NOT edit any `*.test.ts`.**
- The tests are the spec — read `eval.test.ts` and `eval-runner.test.ts`.
- `cd engine && npm run check` (tsc + eslint + vitest) must be FULLY green. Strict TS, no `any`, `import type`.
- Mind edge cases (empty results, zero-result modes, winner tiebreak).
- Run the check yourself before declaring done. Print `DONE`.

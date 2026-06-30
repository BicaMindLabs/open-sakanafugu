You are implementing a real feature module in the **FuguNano** engine (a TypeScript
multi-agent orchestration tool) at the current directory. Work inside `engine/src`.

## Task
Implement the `eval` benchmark-runner module. Read `benchmarks/case-c-eval/CONTRACT.md`
(if present in the repo root) — the types and tests are ALREADY WRITTEN and FROZEN; you only
fill in the implementations that currently `throw new Error('… not implemented (Case C)')`.

Concretely:
1. `engine/src/domain/eval.ts` — implement `aggregateResults` and `formatMetricsTable`.
2. `engine/src/adapters/eval/eval-runner.ts` — implement `runEvalSuite`.
3. (bonus) `engine/src/cli/commands/eval.ts` + register in `engine/src/cli/cli.ts`.

The tests (`engine/src/domain/eval.test.ts`, `engine/src/adapters/eval/eval-runner.test.ts`)
ARE the spec — read them and make them pass.

## Hard rules
1. **Use Edit/Write to actually modify files** under `engine/src/`.
2. **Do NOT edit any `*.test.ts` file.** Do NOT modify existing passing code beyond what's needed.
3. Respect the repo's strict standards: `npm run check` = `tsc --noEmit` + ESLint + vitest must be FULLY green. No `any`, use `import type`, follow existing style.
4. Implement to the contract (read CONTRACT.md + the tests). Edge cases: empty results, zero-result modes, multi-level tiebreak for `winner`.
5. When done, run `cd engine && npm run check` yourself to confirm green, then print one line: `DONE`.

If the contract is ambiguous, make a reasonable call — do not ask back.

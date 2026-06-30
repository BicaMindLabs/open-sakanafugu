# Case A — "tqdm presets": orchestration vs single-model benchmark

A reproducible benchmark that measures whether FuguNano's orchestration
(plan → parallel dispatch → integrate → review → fix-loop) beats a single model
on a **real, cross-module feature** in a popular open-source repo.

- **Target repo**: [tqdm/tqdm](https://github.com/tqdm/tqdm) — 29.8k★, Python, small
  core (`tqdm/std.py` + `cli.py` + `utils.py`), `pytest` suite, `flake8`. Chosen for
  high stars + small code + simple function + clean file-level seams.
- **Feature**: a named-preset system (`--preset`, `--list-presets`, `--save-preset`
  + a `tqdm/presets.py` module). Splits naturally across 5 **different files** —
  the seam FuguNano's parallel dispatch + ownership-gated integrate is built for.

## Why this exposes orchestration value (single model is expected to struggle)

A single model must do the whole feature in one pass with no independent check:
it tends to drift from the shared contract, miss a CLI precedence edge, ship a
regression it never re-ran, or forget the gate. FuguNano routes each file to a
specialist, joins all 5, enforces ownership, runs an objective gate, then a
**different-family** reviewer iterates fixes to green.

## Files

| File | Role |
|------|------|
| `CONTRACT.md` | frozen interface — every implementer writes to this exactly |
| `TASK.md` | FuguNano TASK (requirements / subtasks / matrix / acceptance) |
| `prompts/t1..t5-*.md` | 5 file-level dispatch prompts (one owner each) |
| `prompts/baseline-whole.md` | whole-feature prompt for the single-model baseline |
| `ownership.tsv` | file→owner map, fed to `fuguectl integrate --ownership` |
| `setup.sh` / `gate.sh` | clone+deps / deterministic acceptance gate |
| `run-fugunano.sh` / `run-baseline.sh` | the two sides of the comparison |
| `rubric.md` / `results.csv` | blind scoring + results table |

## How to run

```bash
cd <FuguNano repo>
benchmarks/case-a-presets/setup.sh            # clone tqdm + deps + baseline gate

# A) FuguNano orchestration (5 parallel + integrate + codex review + loop)
export FUGUE_CC_WORK=<path to tqdm provider project>
benchmarks/case-a-presets/run-fugunano.sh

# B) single-model baselines — same TASK, same gate, one model, one pass
benchmarks/case-a-presets/run-baseline.sh cc-glm    fugue-cc   # B1 weak
benchmarks/case-a-presets/run-baseline.sh cc-claude fugue-cc   # B2 strong
benchmarks/case-a-presets/run-baseline.sh gpt-5.5   codex      # B3 strong (codex)
```

Run each side **≥3×** (agent variance is large), score blind with `rubric.md`,
append rows to `results.csv`, then plot cost ($) vs quality (/15) — that Pareto
front is the headline result.

## Fairness discipline (keep the comparison honest)

1. **Same model pool, counted honestly.** FuguNano's codex reviewer cost is part of
   FuguNano's bill — don't hide it. The single-model baseline may self-review once
   (so gen≠review is a real orchestration gain, not "it just looked twice").
2. **Same budget cap.** Give the baseline the same token/$/round ceiling the
   orchestration consumed; report both raw and budget-normalised.
3. **Objective gate is the floor.** `gate.sh` must pass before subjective scoring;
   a baseline that fails the gate is scored on defects, not hand-waved through.

## Routing (matches FuguNano's decision tree)

| Task | File | Implementer | Why |
|------|------|-------------|-----|
| T1 | `tqdm/presets.py` (new) | `cc-deepseek` | data model / serialisation / validation logic |
| T2 | `tqdm/cli.py` | `cc-mimo` | general CLI coding (core seam — caught by review) |
| T3 | `tests/tests_presets.py` (new) | `cc-kimi` | long-context test authoring |
| T4 | `README.rst` | `cc-glm` | docs/docstrings |
| T5 | `tqdm/utils.py` | `cc-stepfun` | recursive `deep_merge` + path logic |
| Review | — | `gpt-5.5` (codex) | gen ≠ review, different family |

## Expected picture

- vs **single-weak** (cc-glm): orchestration wins on quality + gate pass + fewer
  regressions — the cheap-model pool, coordinated, beats one cheap model.
- vs **single-strong** (cc-claude / codex): orchestration should match or approach
  quality at materially lower cost, or match cost at higher quality — the Pareto
  argument that justifies the orchestration layer.

> Scope note: this is one cross-module coding task, not a benchmark suite. For a
> publishable number, run this harness over a slice of **SWE-bench-lite** (real
> issues with test verdicts) — `gate.sh` generalises to "does the repo's test for
> this issue pass".

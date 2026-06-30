# TASK-{date}-{n}: tqdm "presets" feature (Case A benchmark)

Status: IN_PROGRESS
Priority: P1
Created: {time}
Completed: -

## Requirements

Add a named-preset system to tqdm so a user can save/load bundles of tqdm kwargs
and apply them from the CLI. This is the benchmark payload for **Case A** (a
cross-module feature that exercises the full FuguNano pipeline: Plan → Dispatch
→ Integrate → Review → Loop). See `CONTRACT.md` for the frozen interface.

Functional acceptance (all must hold):

1. `python -c "import tqdm.presets"` succeeds; `from tqdm import presets` works.
2. `presets.apply("verbose")` returns a dict usable as `tqdm(**...)`.
3. `presets.apply("__missing__")` raises `presets.PresetError`.
4. `presets.save("x", {...])` then `presets.load()["x"]` round-trips.
5. `tqdm --list-presets` exits 0 and prints ≥3 presets.
6. `tqdm --preset compact < /dev/null` runs without error.
7. Existing behaviour unchanged: `tests/tests_tqdm.py`, `tests/tests_main.py`,
   `tests/tests_utils.py` still pass (`-k "not perf"`).

## Subtasks

- [ ] T1 — implement `tqdm/presets.py` (data model, load/save/merge/validate/apply, BUILTIN_PRESETS) (Implementer: cc-deepseek)
- [ ] T2 — wire `--preset` / `--list-presets` / `--save-preset` into `tqdm/cli.py` (Implementer: cc-mimo)
- [ ] T3 — write `tests/tests_presets.py` covering presets + cli integration (Implementer: cc-kimi)
- [ ] T4 — document presets in `README.rst` (usage + example) (Implementer: cc-glm)
- [ ] T5 — add `deep_merge` + `user_config_dir` to `tqdm/utils.py` (Implementer: cc-stepfun)
- [ ] Final Review (Reviewer: gpt-5.5 / coder, gen ≠ review)

## Output files

- tqdm/presets.py
- tqdm/utils.py
- tqdm/cli.py
- tests/tests_presets.py
- README.rst

## Matrix

| Task  | Implementer  | Reviewer | Fixer               |
| ----- | ------------ | -------- | ------------------- |
| T1    | cc-deepseek  | gpt-5.5  | operator Edit patch |
| T2    | cc-mimo      | gpt-5.5  | operator Edit patch |
| T3    | cc-kimi      | gpt-5.5  | operator Edit patch |
| T4    | cc-glm       | gpt-5.5  | operator Edit patch |
| T5    | cc-stepfun   | gpt-5.5  | operator Edit patch |
| Final | —            | gpt-5.5  | operator Edit patch |

## Acceptance gate (deterministic — see gate.sh)

- import smoke
- `pytest tests/tests_presets.py -q` green
- `pytest tests/tests_tqdm.py tests/tests_main.py tests/tests_utils.py -q -k "not perf"` green (no regression)
- `flake8 --max-line-length=99 tqdm/presets.py tqdm/utils.py tqdm/cli.py` clean
- `tqdm --list-presets` exits 0

## Log

(append in real time)

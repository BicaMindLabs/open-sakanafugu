Your role: solo Python engineer. You are working inside a git worktree; the cwd is already the worktree root of the `tqdm` repository.

## Task (single-model baseline — do ALL of it yourself, no parallel split)

Implement the **tqdm presets feature** end to end, by yourself, in one pass. Read `benchmarks/case-a-presets/CONTRACT.md` for the frozen interface and implement:

1. `tqdm/utils.py` — add `deep_merge(base, override)` and `user_config_dir(app="tqdm")`.
2. `tqdm/presets.py` (new) — `PresetError`, `BUILTIN_PRESETS` (≥3: compact/verbose/minimal), `default_user_path`, `load`, `save` (atomic), `merge`, `validate`, `apply`.
3. `tqdm/cli.py` — add `--preset NAME`, `--list-presets`, `--save-preset NAME` (precedence: explicit flags > preset > defaults; list/save short-circuit before the bar).
4. `tests/tests_presets.py` (new) — pytest covering utils helpers, presets API round-trip, validation, missing/malformed file, and CLI integration.
5. `README.rst` — a short "Presets" section with one usage example.

## Hard requirements

1. **Use Read/Edit/Write tools to actually modify the files** — do not print code in chat.
2. Follow the repo's existing style (≤99 cols, `flake8`-clean, pytest under `-W=error`/`timeout=30`, `.rst` conventions). stdlib only.
3. Acceptance gate (run it yourself before declaring done):
   - `python -c "import tqdm.presets"` ok
   - `pytest tests/tests_presets.py -q` green
   - `pytest tests/tests_tqdm.py tests/tests_main.py tests/tests_utils.py -q -k "not perf"` green (no regression)
   - `flake8 --max-line-length=99 tqdm/presets.py tqdm/utils.py tqdm/cli.py` clean
   - `python -Om tqdm --list-presets` exits 0
4. When done, print exactly one line: `DONE: tqdm/presets.py,tqdm/utils.py,tqdm/cli.py,tests/tests_presets.py,README.rst`
5. If something is genuinely ambiguous, make a reasonable call — do not ask back.

You are the whole team — there is no reviewer to catch mistakes, so be careful and self-check against the gate before printing DONE.

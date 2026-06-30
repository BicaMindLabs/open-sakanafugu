Your role: Python test engineer (T3). You are working inside a git worktree; the cwd is already the worktree root of the `tqdm` repository.

## Task

Create `tests/tests_presets.py` only — a pytest suite for the presets feature. Read `benchmarks/case-a-presets/CONTRACT.md` first for the exact public surface. Match the existing test style in `tests/tests_tqdm.py` / `tests/tests_utils.py` (look at them first).

Cover at least:

- `utils.deep_merge` recursion + override-wins (incl. the contract example `{"a":{"b":1}}` + `{"a":{"c":2}}` → `{"a":{"b":1,"c":2}}`) and `utils.user_config_dir` respects `XDG_CONFIG_HOME` (monkeypatch env)
- `presets.BUILTIN_PRESETS` has ≥3 entries; every value is a dict
- `presets.apply("verbose")` returns a dict; `presets.apply("__missing__")` raises `PresetError`
- `presets.save` → `presets.load` round-trip (use `tmp_path`, monkeypatch `default_user_path` or pass `path=` explicitly)
- `presets.validate` raises on non-dict data and empty name
- `load` returns builtins-only when the user file is absent; raises `PresetError` on malformed JSON
- CLI integration via `subprocess`/`pytest`'s cli runner: `tqdm --list-presets` exits 0 with ≥3 lines; `tqdm --preset compact < /dev/null` exits 0

## Hard requirements

1. **Use Read/Edit/Write tools to actually create `tests/tests_presets.py`** — do not print code in chat.
2. Use `tmp_path` / `monkeypatch` for filesystem state — never write to the real user config dir. No network.
3. Tests must pass under the repo's pytest config (`-W=error`, `timeout=30`) — so catch/`pytest.raises` where the contract says a function raises, and avoid bare `time.sleep` loops.
4. Lines ≤ 99 cols, `flake8`-clean.
5. When done, print exactly one line: `DONE: tests/tests_presets.py`
6. If something is genuinely ambiguous, make a reasonable call — do not ask back.

If you only print code in chat, integration cannot pick it up and the task fails.

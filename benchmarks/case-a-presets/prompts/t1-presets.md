Your role: Python library implementer (T1 — the presets data model). You are working inside a git worktree; the cwd is already the worktree root of the `tqdm` repository.

## Task

Create `tqdm/presets.py` — a named-preset system for tqdm. Read `benchmarks/case-a-presets/CONTRACT.md` in the repo first; implement **every signature there exactly**. Implement `tqdm/presets.py` only.

You must implement:

- `class PresetError(Exception)`
- `BUILTIN_PRESETS: dict[str, dict]` with at least `compact`, `verbose`, `minimal` (sensible tqdm kwargs for each — e.g. `compact` = narrow single line, `verbose` = desc+rate+eta+elapsed, `minimal` = percentage only)
- `default_user_path() -> pathlib.Path`  (uses `utils.user_config_dir('tqdm') / 'presets.json'`)
- `load(path=None) -> dict[str, dict]`  (builtins deep-merged with the user JSON file; missing file → builtins only; malformed JSON → `PresetError`)
- `save(name, data, path=None) -> None`  (atomic write: tmp file + `os.replace`)
- `merge(base, override) -> dict`  (re-export/wrap `utils.deep_merge`)
- `validate(name, data) -> None`  (raise `PresetError` on non-dict data / empty non-str name)
- `apply(name, cli_overrides=None) -> dict`  (resolve preset + deep-merge overrides; unknown name → `PresetError`; return flat kwargs dict)

## Hard requirements

1. **Use Read/Edit/Write tools to actually modify `tqdm/presets.py`** — do not print code in chat.
2. Import the helpers you need from the contract: `from tqdm.utils import deep_merge, user_config_dir`. Do NOT edit `tqdm/utils.py` (another agent owns it) — assume those two functions exist with the contract signatures.
3. stdlib only (`json`, `os`, `pathlib`). No new dependencies.
4. Follow the repo style: lines ≤ 99 cols, `flake8`-clean, match existing docstring tone.
5. When done, print exactly one line: `DONE: tqdm/presets.py`
6. If something is genuinely ambiguous, make a reasonable call — do not ask back.

If you only print code in chat, integration cannot pick it up and the task fails.

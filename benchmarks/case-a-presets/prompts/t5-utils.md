Your role: Python utility implementer (T5). You are working inside a git worktree; the cwd is already the worktree root of the `tqdm` repository.

## Task

Edit `tqdm/utils.py` only. Read `benchmarks/case-a-presets/CONTRACT.md` first. Add two pure helper functions to `tqdm/utils.py`:

```python
def deep_merge(base: dict, override: dict) -> dict:
    """Recursive, non-destructive dict merge; `override` wins on conflict.
    Nested dicts recurse; a non-dict value in `override` replaces the `base` value.
    Returns a new dict; never mutates inputs."""

def user_config_dir(app: str = "tqdm") -> "pathlib.Path":
    """XDG-aware user config dir.
    POSIX: $XDG_CONFIG_HOME/<app> or ~/.config/<app>.
    Windows: %APPDATA%/<app>. Creates the directory if it does not exist.
    Returns the path as a pathlib.Path."""
```

## Hard requirements

1. **Use Read/Edit/Write tools to actually modify `tqdm/utils.py`** — do not print code in chat.
2. `deep_merge` must satisfy the contract example exactly: `deep_merge({"a":{"b":1}}, {"a":{"c":2}}) == {"a":{"b":1,"c":2}}`, and must not mutate `base` or `override`.
3. `user_config_dir` must honour `XDG_CONFIG_HOME` on POSIX and `%APPDATA%` on Windows (use `sys.platform` / `os.environ`); create the dir with `exist_ok=True`.
4. stdlib only. Lines ≤ 99 cols, `flake8`-clean, match the file's existing docstring style.
5. Do not touch any other file (`tqdm/presets.py`, `tqdm/cli.py`, tests, README).
6. When done, print exactly one line: `DONE: tqdm/utils.py`
7. If something is genuinely ambiguous, make a reasonable call — do not ask back.

If you only print code in chat, integration cannot pick it up and the task fails.

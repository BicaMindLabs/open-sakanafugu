# Interface Contract — Case A "tqdm presets"

> This is the integration contract for the 5 parallel subtasks. Every implementer
> writes against these signatures **exactly** — the Integrator merges by matching
> them. Names/types are frozen; bodies are free.

## Feature (one sentence)

Add a **named-preset** system to tqdm: a user can save/load a named bundle of
tqdm kwargs (`desc`, `bar_format`, `colour`, `mininterval`, `ncols`, …) and apply
it from the CLI via `--preset NAME`. Built-in presets ship with the package;
user presets live in a JSON file under the user config dir.

## Files & owners

| Task | File (in the tqdm repo)      | Owner agent   |
| ---- | ---------------------------- | ------------- |
| T1   | `tqdm/presets.py` (new)      | `cc-deepseek` |
| T2   | `tqdm/cli.py` (edit)         | `cc-mimo`     |
| T3   | `tests/tests_presets.py` (new) | `cc-kimi`   |
| T4   | `README.rst` (edit)          | `cc-glm`      |
| T5   | `tqdm/utils.py` (edit)       | `cc-stepfun`  |

Reviewer (gen ≠ review, different family): `gpt-5.5` via `--harness codex`.

## Signatures (frozen)

### `tqdm/utils.py` — T5 adds two pure helpers

```python
def deep_merge(base: dict, override: dict) -> dict:
    """Recursive, non-destructive dict merge; `override` wins on conflict.
    Nested dicts recurse; non-dict values in `override` replace `base`."""

def user_config_dir(app: str = "tqdm") -> "pathlib.Path":
    """XDG-aware user config dir: $XDG_CONFIG_HOME/<app> or ~/.config/<app>
    on POSIX, %APPDATA%/<app> on Windows. Creates the dir if missing."""
```

### `tqdm/presets.py` — T1 (imports T5's helpers)

```python
class PresetError(Exception):
    """Raised for invalid preset names or malformed preset data."""

# Built-in presets bundled with the package. Each value is a dict of tqdm kwargs.
BUILTIN_PRESETS: dict[str, dict] = {
    "compact": {...},   # short, single-line, no rate
    "verbose": {...},   # full: desc + rate + eta + elapsed
    "minimal": {...},   # just the percentage, narrow
}

def default_user_path() -> "pathlib.Path":
    """user_config_dir('tqdm') / 'presets.json'."""

def load(path: "pathlib.Path | None" = None) -> dict[str, dict]:
    """BUILTIN_PRESETS deep-merged with the user file at `path`
    (default = default_user_path()). Missing file => builtins only.
    Never raises on missing file; raises PresetError on malformed JSON."""

def save(name: str, data: dict, path: "pathlib.Path | None" = None) -> None:
    """Load existing user file, set presets[name]=data, write back atomically
    (write tmp + os.replace). `data` must be a dict of JSON-serialisable values."""

def merge(base: dict, override: dict) -> dict:
    """Thin wrapper over utils.deep_merge (re-exported for callers that don't
    want to import utils)."""

def validate(name: str, data: dict) -> None:
    """Raise PresetError if `data` is not a dict, or if `name` is empty/non-str.
    Arbitrary tqdm kwargs are allowed (we do not whitelist kwarg keys)."""

def apply(name: str, cli_overrides: dict | None = None) -> dict:
    """Resolve preset `name` (load() merged store) + deep_merge `cli_overrides`
    on top; raise PresetError if `name` unknown. Returns a flat kwargs dict
    meant to be splatted into `tqdm(**apply('verbose'))`."""
```

### `tqdm/cli.py` — T2 adds three CLI options to `main()` / the argument parser

```
--preset NAME        apply preset NAME's kwargs (overridable by other CLI flags)
--list-presets       print one "name: <one-line summary>" line per preset, exit 0
--save-preset NAME   persist the current effective CLI options as preset NAME, exit 0
```

- Precedence: explicit CLI flags > `--preset` > tqdm defaults.
- `apply()` output feeds `tqdm(**kwargs)`; only the long-form/`main()` code path
  needs to change (the streaming pipe loop keeps working on `infile`).
- `--list-presets` / `--save-preset` must short-circuit before the progress loop.

## Conformance rules (what the reviewer checks at integrate time)

1. `python -c "import tqdm.presets"` works (T1 registered as a submodule; no
   need to touch `tqdm/__init__.py`).
2. `deep_merge({"a":{"b":1}}, {"a":{"c":2}}) == {"a":{"b":1,"c":2}}` (T5 contract).
3. `apply("compact")` returns a dict; `apply("nope")` raises `PresetError` (T1↔T2 contract).
4. `tqdm --list-presets` exits 0 and lists ≥3 presets (T2 contract).
5. No new runtime dependency (stdlib `json`, `os`, `pathlib` only; `XDG` via env).

## Anti-coupling note for parallel work

T2 imports `from tqdm import presets` and calls `presets.apply/list/load/save`.
T1 imports `from tqdm.utils import deep_merge, user_config_dir`.
**Do not edit another owner's file.** If you need a helper that isn't in this
contract, add it to your own file and note it for the reviewer — do not reach
into someone else's module.

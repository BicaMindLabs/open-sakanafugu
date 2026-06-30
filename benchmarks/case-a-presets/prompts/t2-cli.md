Your role: Python CLI implementer (T2 — wire presets into the tqdm CLI). You are working inside a git worktree; the cwd is already the worktree root of the `tqdm` repository.

## Task

Edit `tqdm/cli.py` only. Read `benchmarks/case-a-presets/CONTRACT.md` first. Add three options to the CLI (`main()` / the argument parser):

- `--preset NAME` — apply preset `NAME`'s kwargs (other explicit CLI flags still override)
- `--list-presets` — print one `name: <short summary>` line per available preset, exit 0
- `--save-preset NAME` — persist the current effective CLI options as preset `NAME`, exit 0

## Integration contract you depend on (do not implement, just call)

`from tqdm import presets` and use `presets.apply(name, cli_overrides)`, `presets.load()`, `presets.save(name, data)`. Another agent (`cc-deepseek`) owns `tqdm/presets.py`; another agent (`cc-stepfun`) owns `tqdm/utils.py`. **Do not edit those files.**

## Hard requirements

1. **Use Read/Edit/Write tools to actually modify `tqdm/cli.py`** — do not print code in chat.
2. Precedence must be correct: explicit CLI flags > `--preset` > tqdm defaults. Apply `presets.apply(...)` first, then overlay parsed CLI args.
3. `--list-presets` and `--save-preset` short-circuit **before** the progress/streaming loop; they must not consume stdin or start a bar.
4. Do not change the existing streaming behaviour (`tqdm < infile` pipe path) beyond threading in the preset kwargs.
5. Lines ≤ 99 cols, `flake8`-clean, match the file's existing style.
6. When done, print exactly one line: `DONE: tqdm/cli.py`
7. If something is genuinely ambiguous, make a reasonable call — do not ask back.

If you only print code in chat, integration cannot pick it up and the task fails.

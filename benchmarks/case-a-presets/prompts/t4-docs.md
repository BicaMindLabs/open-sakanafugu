Your role: technical writer (T4 — document the presets feature). You are working inside a git worktree; the cwd is already the worktree root of the `tqdm` repository.

## Task

Edit `README.rst` only. Read `benchmarks/case-a-presets/CONTRACT.md` first for the user-facing surface. Add a concise **"Presets"** section to the README documenting:

- what presets are and where they live (built-in vs `~/.config/tqdm/presets.json`)
- the three CLI flags: `--preset NAME`, `--list-presets`, `--save-preset NAME`
- one copy-pasteable usage example (e.g. `tqdm --preset compact < data.txt`, and `tqdm --save-preset myteam ...`)
- the Python API one-liner: `tqdm(**presets.apply("verbose"))`

## Hard requirements

1. **Use Read/Edit/Write tools to actually modify `README.rst`** — do not print text in chat.
2. Match the existing `.rst` style of the file (heading underline chars, code-block directives, tone). Keep it short — one focused section, no marketing fluff.
3. Do not invent flags or behaviour beyond the contract.
4. When done, print exactly one line: `DONE: README.rst`
5. If something is genuinely ambiguous, make a reasonable call — do not ask back.

If you only print text in chat, integration cannot pick it up and the task fails.

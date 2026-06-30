You are fixing real bugs in the `commander.js` library at the current directory.
You are the whole team — there is no reviewer to catch your mistakes, so be careful.

## Task
Run `node --test`. There are **3 failing tests** in `tests/caseB-*.test.js`, each
caused by a bug in `lib/command.js`. Make ALL tests pass.

## Rules
- Edit ONLY `lib/command.js`. Do NOT modify any test file.
- Minimal, correct edits. All 3 bugs are in negative-number parsing and are
  related (decimal operands, optional-option values, variadic collection).
- Run the FULL suite to confirm no regression, then print `DONE`.

You are fixing real bugs in the `commander.js` library at the current directory.

## Task
Run the tests with `node --test`. There are **3 failing tests**, all in the
`tests/caseB-*.test.js` files. Each fails because of a bug in `lib/command.js`.
Make ALL tests pass.

## Rules
- Edit ONLY `lib/command.js`. Do NOT modify any test file (`tests/**`).
- Make minimal, correct edits — these are real bugs in negative-number parsing
  (decimal operands, optional-option values, variadic option collection).
- Do not break any currently-passing test (run the full suite).
- After editing, run `node --test` yourself to confirm everything is green.
- When done, print one line: `DONE`.

## Hints
- The 3 bugs are related and likely share a common root cause in how
  negative numbers are detected/accepted.
- `node --test tests/caseB-bug1.test.js` runs just one bug's test for fast feedback.

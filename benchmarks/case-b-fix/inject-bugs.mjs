// Inject 3 related bugs into commander's parseOptions negative-number handling.
// Run inside the commander repo root (reads lib/command.js). Deterministic: fails
// loudly if the commander source has drifted (so a version bump is caught).
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "lib/command.js";
let src = readFileSync(FILE, "utf8");
let count = 0;

const repl = (label, from, to) => {
  if (!src.includes(from)) {
    throw new Error(
      `inject: anchor not found for ${label} — commander source drifted.\n  expected: ${from}`,
    );
  }
  src = src.replace(from, to);
  count++;
};

// B1: negativeNumberArg no longer recognises decimals / scientific notation
//   (only plain integer negatives like -5). A leaf command receiving -3.14 now
//   treats it as an unknown option and errors.
repl(
  "B1",
  String.raw`if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;`,
  String.raw`if (!/^-(\d+)$/.test(arg)) return false;`,
);

// B2: an optional option like --offset [n] no longer accepts a negative number
//   as its value — the leading '-' makes the next arg look like an option.
repl(
  "B2",
  String.raw`(!maybeOption(args[i]) || negativeNumberArg(args[i]))`,
  String.raw`(!maybeOption(args[i]))`,
);

// B3: a variadic option like --vals [n...] stops collecting at the first
//   negative number, instead of absorbing them.
repl(
  "B3",
  String.raw`(!maybeOption(arg) || negativeNumberArg(arg))`,
  String.raw`(!maybeOption(arg))`,
);

writeFileSync(FILE, src);
console.log(`injected ${count} bugs into ${FILE}`);

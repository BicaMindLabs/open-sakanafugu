import { Command } from "commander";
import { test } from "node:test";
import assert from "node:assert";

// B2: an optional option with a negative-number value must capture the value.
// Bug: the optional-arg branch dropped the negativeNumberArg exception, so the
// following -5 is treated as a (missing) option and offset stays null.
test("caseB B2: optional option takes a negative number value", () => {
  const program = new Command().exitOverride();
  program.option("--offset [n]");
  program.parse(["node", "prog", "--offset", "-5"]);
  assert.equal(program.opts().offset, "-5");
});

import { Command } from "commander";
import { test } from "node:test";
import assert from "node:assert";

// B1: a leaf command must accept a decimal negative number as an operand.
// Bug: negativeNumberArg only matches integer negatives, so -3.14 looks like an
// unknown option and parse() throws.
test("caseB B1: leaf command accepts a decimal negative operand", () => {
  const program = new Command().exitOverride();
  program.argument("[vals...]");
  program.parse(["node", "prog", "-3.14"]);
  assert.deepEqual(program.args, ["-3.14"]);
});

import { Command } from "commander";
import { test } from "node:test";
import assert from "node:assert";

// B3: a variadic option must collect following negative numbers.
// Bug: the variadic branch dropped the negativeNumberArg exception, so collection
// stops at the first negative and the remaining args are misread as options.
test("caseB B3: variadic option collects following negative numbers", () => {
  const program = new Command().exitOverride();
  program.option("--vals [nums...]");
  program.parse(["node", "prog", "--vals", "-1", "-2", "-3"]);
  assert.deepEqual(program.opts().vals, ["-1", "-2", "-3"]);
});

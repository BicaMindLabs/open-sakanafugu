#!/usr/bin/env python3
"""Evaluate a candidate patch for one SWE-bench instance (harness-free core).

Usage:
  eval_instance.py <dataset.jsonl> <instance_id> <repo_dir>

Assumes prepare_instance.py already ran (base commit + test_patch applied) and a
candidate solution patch is applied in <repo_dir>. Runs FAIL_TO_PASS tests and a
sample of PASS_TO_PASS tests; prints a JSON verdict.

resolved = FAIL_TO_PASS all pass AND no PASS_TO_PASS sample regression.

Override the test runner with $TEST_CMD (argv string, e.g.
"python3 -m pytest -x -q"). Default uses python3. All subprocess calls use argv
lists (no shell=True) — test ids are passed as separate argv elements, never
through a shell, so dataset-provided names can't be interpreted as metacharacters.
"""
import json
import os
import subprocess
import sys
from pathlib import Path


def find_instance(dataset_path, instance_id):
    with open(dataset_path) as fh:
        for line in fh:
            rec = json.loads(line)
            if rec["instance_id"] == instance_id:
                return rec
    raise SystemExit(f"instance {instance_id} not found")


def run_tests(repo, tests, test_argv):
    # test_argv = base runner argv (e.g. ["python3","-m","pytest","-x","-q"]);
    # each test id is appended as its own argv element — never joined into a shell string.
    if not tests:
        return 0
    res = subprocess.run(test_argv + list(tests), cwd=str(repo), capture_output=True, text=True)
    return res.returncode  # 0 = all pass


def main():
    dataset_path, instance_id, repo = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    test_argv = os.environ.get("TEST_CMD", "python3 -m pytest -x -q").split()
    rec = find_instance(dataset_path, instance_id)
    fail_to_pass = json.loads(rec["FAIL_TO_PASS"])
    pass_to_pass = json.loads(rec.get("PASS_TO_PASS", "[]"))

    ftp_ok = (run_tests(repo, fail_to_pass, test_argv) == 0) if fail_to_pass else True
    sample_ok = (run_tests(repo, pass_to_pass[:20], test_argv) == 0) if pass_to_pass[:20] else True

    verdict = {
        "instance_id": instance_id,
        "resolved": ftp_ok and sample_ok,
        "fail_to_pass_ok": ftp_ok,
        "pass_to_pass_sample_ok": sample_ok,
    }
    print(json.dumps(verdict))
    sys.exit(0 if verdict["resolved"] else 1)


if __name__ == "__main__":
    main()

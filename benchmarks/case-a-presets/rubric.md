# Blind rubric — Case A (tqdm presets)

Score each run **blind** (reviewer must not know whether it came from FuguNano
orchestration or a single-model baseline). 0–3 per dimension; total /15.

| # | Dimension | 0 | 1 | 2 | 3 |
|---|-----------|---|---|---|---|
| 1 | **Functional completeness** (Req 1–7) | nothing works | 1–2 reqs | 3–5 reqs | all 7 |
| 2 | **Correctness vs CONTRACT** (signatures, precedence, edge cases) | wrong API | drifts from contract | minor edge gaps | exact |
| 3 | **Test quality** (coverage of round-trip / malformed / CLI / regression) | none | happy-path only | solid core | rigorous incl. failure paths |
| 4 | **Regression safety** (existing tests + lint + no unrelated edits) | breaks core | regressions | clean but noisy diff | surgical, clean |
| 5 | **Code quality / docs** (style ≤99 cols, idiomatic, README clear) | poor | rough | clean | polished |

## Reviewer prompt seed (gen ≠ review — use codex / a different family)

```
You are an independent reviewer scoring a blind submission of the tqdm "presets"
feature. You do NOT know which approach produced it. Read CONTRACT.md, the diff,
and run gate.sh. Score dimensions 1–5 (0–3 each, /15 total) with one-sentence
justification per dimension. Also list any concrete defects (file:line).
```

## What to record (per run)

- approach: `fugunano` | `single-weak` | `single-strong`
- quality_score: /15
- gate_pass: yes/no  ·  gate_fails: (which check)
- regressions: count of newly-failing existing tests
- review_rounds: Phase-5 iterations to ACCEPTED (orchestration only)
- wallclock_s · tokens · cost_usd
- defects: free text

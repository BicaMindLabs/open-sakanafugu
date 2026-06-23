# End-to-End Workflow Walkthrough

The complete pipeline that takes a requirement from "one sentence" all the way to "reviewed and merged into the main branch."
Four roles, seven phases — fully replayable, interruptible, and auditable.

---

## Roles

| Layer | Who | Does | Does not do |
|---|---|---|---|
| Strategy / Planner | **Claude Desktop** (Opus, 1M) | Write requirements, split tasks, set acceptance criteria | Does not enter the ccb pane, does not write implementation code |
| Execution + Supervisor | **Claude Code** (fanout skill) | Dispatch clones, integrate, run the quality gate, run tests, log the TASK | Does not hand-write large blocks of implementation (except Phase 5 patches) |
| Implementers | **9 Chinese-model CC clones** (ccb work/ark windows) | Write subtasks each in their own worktree | Do not read each other's code, do not touch the main branch |
| Frontend (opt-in) | **Antigravity (`agy` CLI)** | Frontend/UI subtasks, manual IDE or headless `agy --print` | **Does not enter the Phase 5 loop, never acts as reviewer** (backend = Gemini, honoring no-Gemini) |
| Reviewer | **Codex** (gpt-5.5, ccb review window) | Adversarial review, gives VERDICT + Findings | Does not write implementation (keeps generation != review independence); the review path never uses Gemini |

> The maintenance layer **cc-sync** is not on the request path; it is a background launchd daemon: CC upgrade tracking + model refresh + monthly rebuild.

---

## The Seven-Phase Pipeline

### Phase 0 — Open the Task (Planner)
Claude Desktop writes the requirement into a task file `~/.claude/tasks/TASK-YYYY-MM-DD-NNN.md`: requirements / subtasks (annotated with which AI is assigned) / acceptance criteria / output files. This is the single source of intent for the whole pipeline.

### Phase 1 — Split and Assign (fanout)
Claude Code reads the task, splits it into parallelizable subtasks, and picks backends by the decision tree:
- Chinese-language scenario / domestic API / SQL -> Chinese-model clone (doubao/qwen/glm/kimi...)
- English / algorithms / refactoring -> coder(Codex) or a strong-reasoning clone (deepseek/minimax)
- Math and logic -> stepfun
- One subtask = one independent, copy-ready prompt (**no broadcasting a single generic prompt to everyone**).

### Phase 2 — Parallel Implementation + Cache + fan-in barrier (Implementers)
After `cd proj && ccb` brings up the windows:
1. **Open this round's cache**: `fanout-cache.sh init <round> t1:cc-deepseek t2:cc-glm t3:agy ...` — declare the N tasks dispatched this round (the fan-out manifest).
2. **Dispatch**: `ccb ask <agent> --compact "<prompt>"` asynchronously; each clone edits in its own worktree.
3. **Results land in the cache first**: each agent's output goes to `fanout-cache.sh put <round> <task_id> <file>` (dead/timed-out -> `fail`, which also counts as "returned"). **Never read from volatile chat/scrollback.**
4. **fan-in barrier (hard gate)**: `fanout-cache.sh barrier <round> --wait 600` — **if N were dispatched, N must come back** (all terminal) for exit 0; otherwise Phase 3 is not allowed. Stuck tasks surface here and are never silently dropped.

> Logical contract: however many tasks Claude Desktop dispatched, that many must come back before entering the next round. Every round (including each loop of Phase 5) passes this barrier.

### Phase 3 — Integration (fanout)
Once the barrier passes (all N returned), Claude Code pulls outputs from the cache (`fanout-cache.sh collect <round>`) + cherry-picks each clone's worktree changes onto the main working branch,
resolves conflicts, unifies style, and runs a local sanity baseline (build/test/lint).

### Phase 4 — Review (Reviewer)
`ccb ask coder --compact "Review this change: <diff>"` -> Codex gives a `VERDICT` (ACCEPTED / NEEDS FIX) + `Findings`.
Generation != review: implementation is by Chinese-model clones, review is by Codex — cross-vendor and independent.

### Phase 5 — Review-Fix Loop (bounded closed loop, upgraded per 2026-06 loop engineering research)
Automatically iterate **fix -> re-review** until it passes review, with a capped fallback. See `orchestration/fanout/SKILL.md` Phase 5 for details; key points:

1. **Deterministic gate first** — each round runs build/test/lint first (objective pass/fail); red must be fixed, don't waste Codex.
2. **Codex subjective review (incremental)** — from round 2 on, review only this round's diff (saves tokens + stays focused).
3. **keep-best anti-regression** — if a round is worse than the previous one / introduces new problems -> `git reset` back to the best version, discarding the bad change (prevents degeneration of thought).
4. **>=2 confirmation passes** — even after the first ACCEPTED, add one independent confirmation (verification is probabilistic).
5. **Fix = Claude Edit patch** (v4 hard rule, no bouncing back to the clone for a rewrite) + write each round into the TASK file for the audit trail.
6. **Three exit states**: ACCEPTED -> DONE / over MAX_ROUNDS(3) -> escalate to a human / **non-converging -> Meta-Reflector** (first reflect on "why it won't fix" with diagnosis + suggestions, then escalate — not a plain retry).

Research basis: 1-2 rounds capture ~75% of the improvement, a hard cap of 5-6 rounds prevents oscillation, generation != review adds ~+20%.
sources: [LLM Verification Loops](https://timjwilliams.medium.com/llm-verification-loops-best-practices-and-patterns-07541c854fd8) · [Loop Engineering 2026](https://shaam.blog/articles/loop-engineering-ai-agents) · Reflexion / Self-Refine.

### Phase 6 — Wrap-up (fanout)
Review passes -> merge into the main branch, mark the TASK file `DONE`, clean up worktrees, write memory (non-obvious gotchas/decisions).

---

## Two Ways to Run

| | Lightweight single-machine (`/cn:*` plugin) | Full multi-Agent (ccb multi-window) |
|---|---|---|
| When to use | One or two subtasks, quick validation | Real fan-out, want the review loop |
| Startup | `/cn:team` `/cn:ask` inside Claude Code | `cd proj && ccb` brings up planner/work/ark/review |
| Isolation | Same process, no worktree | Each clone gets its own worktree |
| Review | Manual | Phase 4-5 automatic loop |
| Config | No ccb.config needed | Needs `.ccb/ccb.config` (copy `.example`, fill in the key) |

---

## Maintenance Layer: cc-sync (background launchd)

```bash
cc-sync cli              # Upgrade all envs + the main claude to the latest @anthropic-ai/claude-code
cc-sync models [--apply] # Probe each provider's /v1/models, report/append new models (default profile untouched)
cc-sync research         # agent: read each vendor's official docs -> learn -> rebuild launchers -> live verification
cc-sync all              # cli + models
```

- `WatchPaths` pins the global claude-code `package.json` -> follows upstream the moment it upgrades.
- Monthly `cc-sync research` (launchd `StartCalendarInterval`, the 1st of each month at 05:00) -> doc-driven rebuild.
- **Default/flagship profile changes are always manual** — model fit needs human judgment; automation only "proposes," never "swaps the default."

---

## Security Boundary

- Keys live only in `~/.config/cc-model-secrets.env` (read by the launcher, highest priority); the repo only has `ccb.config.example`.
- `.gitignore` ignores `**/.ccb/ccb.config` / `*secrets*.env` / `.env*`; a hard secret scan runs before push, only 0 hits gets pushed.
- Personal paths are generalized into `$CCB_WORK` / `$CCB_CLAUDE` / `$TASKS` placeholders + the `~/...` convention — substitute for your own environment; a hard secret scan runs before commit, only 0 hits gets pushed.
- Review/second opinion goes through **Codex or opencode**, **never Gemini** (hard rule).

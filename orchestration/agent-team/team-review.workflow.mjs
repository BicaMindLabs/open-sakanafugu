// team-review.workflow.mjs — Agent Team deterministic orchestration example (run by Claude Code's Workflow tool)
//   ① planning panel: multiple models produce decomposition plans in parallel → synthesize
//   ② implement→review: pipeline (each subtask implemented cross-model → reviewed by Codex, no barrier)
// agentType uses the existing Bash-bridge custom agents: cn-dispatch (Chinese models) / codex-rescue (Codex).
// Honor no-Gemini: review only uses codex.
// Note: this file is executed by Claude Code's Workflow tool (with top-level return / agent() etc. injected as globals),
//       it is not a standalone node module —— do not run it with `node` directly, and do not node --check (top-level return errors out).
export const meta = {
  name: 'cn-team-review',
  description: 'multi-model planning → cross-model implementation → Codex review (Agent Team deterministic orchestration)',
  phases: [
    { title: 'Plan' },
    { title: 'Implement' },
    { title: 'Review' },
  ],
}

const goal = (args && args.goal) || 'Example goal: add unit tests to module X and get them all green'

// ① planning panel —— 3 in parallel decompose, take different perspectives
phase('Plan')
const PLANNERS = ['cn-dispatch', 'cn-dispatch', 'codex-rescue']
const plans = (await parallel(PLANNERS.map((p, i) => () =>
  agent(`You are planner #${i + 1}. Decompose the goal into 3-6 parallelizable subtasks, each tagged with scope + suggested implementation model + files to change.\nGoal: ${goal}`,
    { label: `plan:${p}:${i}`, phase: 'Plan', agentType: p })))).filter(Boolean)

const synthesis = await agent(
  `Synthesize the planning proposals below: deduplicate + fill blind spots, produce a final subtask list (each with suggested model + files):\n\n${plans.join('\n---\n')}`,
  { label: 'plan:synthesize', phase: 'Plan' })

// ② implement → review —— pipeline: each subtask implemented cross-model, reviewed by Codex on completion (generation != review)
const SUBTASKS = [
  { id: 't1', agent: 'cn-dispatch', scope: 'core implementation' },
  { id: 't2', agent: 'cn-dispatch', scope: 'edge cases / algorithm' },
]
const results = await pipeline(
  SUBTASKS,
  (t) => agent(`Implement subtask "${t.scope}". You must use Read/Edit/Write to actually change files, do not just output in chat.`,
    { label: `impl:${t.id}`, phase: 'Implement', agentType: t.agent }),
  (impl, t) => agent(`Review whether this change is correct/safe/regression-free. Output VERDICT: ACCEPTED or NEEDS FIX + issue list:\n${impl}`,
    { label: `review:${t.id}`, phase: 'Review', agentType: 'codex-rescue' })
    .then((verdict) => ({ id: t.id, impl, verdict })))

return { goal, synthesis, results: results.filter(Boolean) }

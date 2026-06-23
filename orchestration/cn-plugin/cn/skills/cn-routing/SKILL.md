---
name: cn-routing
description: Decision matrix for selecting Chinese model backends based on task characteristics
user-invocable: false
---

# Chinese Model Routing

Use this skill inside the `cn:cn-dispatch` agent to pick the right model.

## Decision Matrix

| Priority | Signal / Keywords | Model | Why |
|----------|-------------------|-------|-----|
| 1 | SQL, Doris, ADB, PolarDB, RDS, Alibaba Cloud, DashScope | **qwen** | Alibaba ecosystem native |
| 2 | very long text, >200K tokens, multimodal, image+text material, cross-codebase analysis | **mimo** | 1M token-plan Pro plus V2.5/Omni profiles |
| 3 | long text, 50K–200K, papers, contracts, document review | **kimi** | Stable Kimi Code long-context route |
| 4 | math, proofs, logical reasoning, equations, optimization, algorithm derivation | **stepfun** | Math/logic specialist |
| 5 | deep reasoning, Chinese comprehension, semantic analysis, knowledge Q&A | **glm** | Strong Chinese reasoning |
| 6 | fast answers, simple tasks, low latency, lightweight | **minimax** | Stable/highspeed M2 profiles |
| 7 | general Chinese coding, code generation, frontend/visual coding, default | **doubao** | Best all-round Chinese coder |

## Routing Rules

1. **Exact match first**: if the task clearly matches a signal above, use that model.
2. **User override**: if the user explicitly names a model, always respect it.
3. **Ambiguous**: when the task could match multiple models, prefer lower latency:
   `minimax > doubao > qwen > glm > kimi > stepfun > mimo`
4. **Default**: if no signal matches, use `doubao`.
5. **Profile hints**: when forwarding directly, users can pass `--profile <name>` after a `/cn:<model>` command. For smart routing, choose the model only; do not invent profiles unless the user explicitly asks for one.

## Examples

- "write me an ETL SQL for Doris" → **qwen**
- "analyze this 80,000-word research report" → **kimi**
- "prove this inequality" → **stepfun**
- "what does this passage of classical Chinese mean" → **glm**
- "quickly translate this sentence" → **minimax**
- "write a Python web scraper" → **doubao**
- "across these 20 repos find every place that uses a deprecated API" → **mimo** (1M ctx)

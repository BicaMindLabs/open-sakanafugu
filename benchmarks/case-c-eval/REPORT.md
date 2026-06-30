# Case C 测试报告 — FuguNano `eval` 模块实现（长任务）

> 编排 vs 单模型，在 FuguNano **自己**的代码库上从零实现一个完整功能模块。这是三套里最长、最真实的任务。

- **日期**: 2026-06-29
- **载体**: FuguNano engine（TS，strict + ESLint + vitest，545 测试基线）
- **任务**: 实现 `eval` benchmark-runner 模块（`aggregateResults` 多级 tiebreak 统计 + `formatMetricsTable` + `runEvalSuite` 双层循环 + cli），让 `npm run check`(typecheck+lint+test) 全绿
- **fixture**: types + 验收测试由我写定（frozen），实现留 `throw` stub。baseline = 2 个 eval test 红 / 545 绿
- **工具链**: codex gpt-5.5（强）；claude 经 cc-switch 代理到 glm-5.2（弱）

---

## 1. 结果总表（实测）

| 方式 | writer | 客观 gate | 迭代轮数 | 耗时 | final | first-pass review |
|------|--------|----------|---------|------|-------|-------------------|
| 单模型 | codex | ✅ PASS | 1 | 432s | ACCEPTED | ACCEPTED |
| 编排 | codex | ✅ PASS | 1 | 346s | ACCEPTED | ACCEPTED |
| 单模型 | claude(glm) | ✅ PASS | 1 (fix 后) | **1924s** | ACCEPTED | **NEEDS FIX** |
| 编排 | claude(glm) | ✅ PASS | 1 | **911s** | ACCEPTED | **ACCEPTED** |

## 2. 关键发现：编排让弱模型更快、一次过质量更高

聚焦弱模型（glm）的对比 —— 这是编排真正起作用的地方：

- **单模型版**：first pass gate 过（功能对）但 review **NEEDS FIX**（codex 审出质量问题）→ fix 1 次 → ACCEPTED。耗时 **1924s**，2 次模型往返。
- **编排版**：first pass **gate 过 + review 直接 ACCEPTED**，1 轮搞定。耗时 **911s**（≈单模型的一半），1 次往返。

编排版让 glm **首次实现质量就达到 ACCEPTED、且快一倍**。

> 诚实归因：这个优势**主要来自结构化引导**（编排版 prompt 强调读契约+边界、配独立 review 把关），**不是 multi-round loop 的功劳** —— loop 在 glm 编排版 round 1 就满分、根本没触发多轮。也就是说，编排的"结构化任务框架 + 独立评审"本身提升了弱模型的一次通过质量。

## 3. 强模型（codex）编排无优势

codex 单模型/编排都是 round 1 满分 ACCEPTED（432s / 346s）。对足够强的模型，任务不够难，编排 loop 不触发、不增价值。

## 4. review 层的质量价值（贯穿 Case A/C）

"客观 gate 绿 ≠ 代码没问题"。Case C glm 单模型 first pass **gate 已过**，但独立 review 仍抓出 NEEDS FIX —— 这正是 FuguNano「确定性 gate + 独立 review（gen≠review）」的真实价值，和 Case A（gate 绿但 review 抓出 Python 3.8/3.9 兼容性 bug）一致。

## 5. 诚实结论（Case C 单独）

- ✅ **编排对弱模型有真实价值**：结构化引导 + 独立 review 让 glm 首次实现就达 ACCEPTED、耗时减半。
- ✅ **fixture 可解、客观可复现**：strict typecheck+lint+test 作 gate，4 组都最终 PASS，零环境依赖。
- ⚠️ **multi-round loop 未触发**：任务难度下 1 次就够，loop 的多轮迭代价值在本 case 没体现。
- ⚠️ **强模型编排无优势**：codex 1 轮过，编排多余。

## 6. 复现

```bash
cd <FuguNano>/benchmarks/case-c-eval
./setup.sh                                   # clone FuguNano + npm install + 注入 fixture + 验证 baseline 红
CODEX=/Applications/Codex.app/Contents/Resources/codex
WRITER=codex ./run-live.sh single            # codex 单模型
WRITER=codex ./run-live.sh orchestrated      # codex 编排
./run-live.sh single                         # claude(glm) 单模型
./run-live.sh orchestrated                   # claude(glm) 编排
cat results-live.csv
```

baseline 固定（caseC-clean/caseC-buggy git tag）；fixture 在 `fixture/`（types + 验收测试 frozen，实现留 stub）。

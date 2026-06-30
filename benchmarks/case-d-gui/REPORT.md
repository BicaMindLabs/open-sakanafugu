# Case D 测试报告 — FuguNano GUI 工作台

> ⚠️ **注**：Case D 的 web benchmark 工具（gui-skel/fixture/run-live）已移除，桌面应用（`desktop/`）是最终产品。本报告保留作历史结果记录。

> 给 FuguNano 加 GUI 工作台（全栈 TS），既是 dogfood（用 fuguectl 编排开发自己的 GUI），又是编排 vs 单模型对比 case，且 MVP 真能驱动 fuguectl。

- **日期**: 2026-06-30
- **载体**: 新建 `gui/`（React+Vite+TS 前端 + Node 后端 exec fuguectl），独立于 engine
- **任务**: 实现 4 层 GUI（logic 状态机/命令构造 + bridge 可插拔 + server exec + React 组件）让 `npm run check`(tsc+vitest+vite build) 全绿
- **fixture**: types + 验收测试 frozen + throw stub；参考实现 21 tests 全绿（可解）
- **工具链**: codex gpt-5.5（claude 经 cc-switch 代理到 glm-5.2，当日 529 不可用）

## 1. benchmark 结果（实测）

| 方式 | writer | gate | review 轮数 | 耗时 | first-pass review |
|------|--------|------|------------|------|-------------------|
| 单模型 | codex | ✅ PASS | 1 (fix 后) | 438s | **NEEDS FIX** |
| 编排 | codex | ✅ PASS | 1 | **322s** | **ACCEPTED** |

## 2. 关键发现：编排优势首次清晰显现（对比 A/B/C）

Case A/B/C 里 codex 两版都 1 轮满分，编排无优势。**Case D 不同**：

- **单模型版**：codex first pass gate 过但 review **NEEDS FIX**（GUI 4层+UI测试+server 足够复杂，连 codex 都漏了 review 抓的点）→ fix 1 次 → ACCEPTED。438s，2 次模型往返。
- **编排版**：codex first pass **直接 ACCEPTED**（score=3），1 次往返，322s（快 116s）。

**归因**：编排版的结构化引导（impl-task prompt 强调读契约+边界、配独立 review 把关）让 codex 首版质量就达标。和 Case C（glm）的模式一致，但 Case D 是 codex（强模型）也吃力——说明**任务难度终于够了**，编排的"结构化引导+独立 review"价值显现。

## 3. MVP 真跑（产品验证，不只是对比）

端到端链路打通：浏览器(:5180) → vite → proxy → mvp-server(:8787) → `execFile fuguectl` → 返回。
- `fuguectl version` ✓、`fuguectl preflight --harness codex` → **GO**（codex 就绪）✓
- 安全：`execFile` + tokenizer（无 shell 注入）
- 真跑中发现并修 3 个实际问题（系统代理 502、codex 不在 PATH、exec 注入）→ 见 `MVP-VERIFY.md`

## 4. 诚实约束

- ⚠️ 本组 writer/reviewer 均为 codex（**同族，非真 gen!=review**）。真 gen!=review（glm 写 + codex 审）卡在 glm 当日 529 过载。glm 版若可跑，预期信号更强（弱模型 single 可能更糟，编排 loop 价值更大）。
- ✅ 即便同族，"编排流程 vs 单模型" 的对比仍有效（隔离了流程变量，同模型）：编排首版 ACCEPTED/322s vs single NEEDS FIX/438s。
- ✅ fixture 可解、客观可复现：strict tsc+vitest+vite build 作 gate，零环境依赖（纯 TS/Node）。

## 5. 落盘

```
benchmarks/case-d-gui/
├── DESIGN.md · PLAN.md · CONTRACT.md · MVP-VERIFY.md · REPORT.md(本文件)
├── gui-skel/        # 脚手架模板
├── fixture/         # frozen types+验收测试+stub (给 benchmark 模型)
├── reference/       # 参考实现 (21 tests 绿, MVP 兜底)
├── mvp-server.mjs   # MVP 真跑后端 (execFile fuguectl)
├── setup.sh · gate.sh · run-live.sh · prompts/
└── work/gui/ · results-live.csv
```

## 6. 复现

```bash
cd <FuguNano>/benchmarks/case-d-gui
./setup.sh                                  # 脚手架 + 注入 fixture + baseline
CODEX=/Applications/Codex.app/Contents/Resources/codex
WRITER=codex ./run-live.sh single           # codex 单模型
WRITER=codex ./run-live.sh orchestrated     # codex 编排
cat results-live.csv
```

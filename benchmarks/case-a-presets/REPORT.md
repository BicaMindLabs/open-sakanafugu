# Case A 测试报告 — tqdm「命名预设」功能

> 编排 vs 单模型，在同一真实开源仓库上完成同一跨文件功能。本报告固化实测数据与发现。

- **日期**: 2026-06-29
- **目标仓库**: [tqdm/tqdm](https://github.com/tqdm/tqdm) @ commit `9aff609`（29.8k★, Python, 核心 ~1.5k 行 + pytest 套件）
- **被测任务**: 新增「命名预设」系统（`--preset` / `--list-presets` / `--save-preset` + `tqdm/presets.py` 模块），跨 5 个文件
- **工具链**: writer = codex `gpt-5.5`（high reasoning）；reviewer = codex `gpt-5.5`
- **诚实约束**: 本次两版 writer/reviewer 均为 codex 同族 → **非真正的 gen≠review**。真正的 gen≠review（deepseek 写 + codex 审）因 deepseek 当日高峰 529 未能跑成，脚本已就绪待补。

---

## 1. 结果总表（实测）

| 方式 | writer | 客观 gate | review 迭代轮数 | 耗时 | 最终评审 |
|------|--------|----------|----------------|------|---------|
| **单模型版**（整包一次性） | codex | ✅ PASS | 1 | **782s** | ACCEPTED |
| **编排版**（5文件并行 + review + gate + loop） | codex | ✅ PASS | 3 | **985s** | ACCEPTED |

两种方式**最终都过了客观 gate**（import / 新测试 / 无核心回归 / CLI 冒烟 / ≥3 预设），且最终评审都 ACCEPTED。

原始数据见 `results-live.csv`。

## 2. 客观 gate（两种方式一致，机器判定）

```
✓ tqdm.presets importable
✓ tests/tests_presets.py green
✓ 无核心回归 (tests_tqdm / tests_main / tests_utils)
✓ tqdm --list-presets 退出码 0
✓ 列出 ≥3 个预设
GATE: PASS
```

> 注：flake8 检查项因该 Python 环境未装 flake8 而跳过（非测试失败）。

## 3. 关键发现：gate 绿 ≠ 代码无问题

**两种方式第一轮 gate 都绿，但独立 review 都抓到了真实 bug。** 这正是 FuguNano「客观 gate 先行 + 独立 review 兜底」价值的实证——测试能跑不等于代码没问题。

### 3.1 单模型版首次 review 抓到的 3 个 bug（NEEDS FIX → 修 1 轮 → ACCEPTED）

1. **Python 3.8/3.9 兼容性破坏**（`presets.py:17/44`）— 用了 `dict[str, dict]` / `pathlib.Path | None` 但没有 `from __future__ import annotations`，在 tqdm 声明支持的 Python 3.8/3.9 上**直接 import 失败**。
2. **`--save-preset` 持久化了非 tqdm 参数**（`cli.py:290`）— 把 `bytes`/`delim`/`tee`/`null` 等 CLI 控制标志也存进了预设，违反契约「`apply()` 返回的 kwargs 必须能直接 `tqdm(**...)`」。
3. **测试覆盖缺口**（`tests_presets.py:1`）— 没覆盖 3.8/3.9 import 路径和 CLI-only 标志的保存，导致上面两个回归在本地能"通过"。

### 3.2 编排版迭代轨迹（round 1→3 收敛到 ACCEPTED）

- round 1: gate PASS，review **NEEDS FIX**（score=2）
- round 2: gate PASS，review 仍 **NEEDS FIX**（score=2）
- round 3: gate PASS，review **ACCEPTED**（score=3）— 仅剩 1 条"非阻塞覆盖建议"

> 与 FuguNano 设计依据吻合：1–2 轮抓大部分问题、需上限防震荡（本例 round 3 收敛，未触顶）。

## 4. 本组对比的诚实结论（同族，受限）

⚠️ 本组 writer 与 reviewer 都是 codex，**review 是同族自审，不是 FuguNano 主张的 gen≠review**。因此本组能说明的有限：

- ✅ **端到端可用**：整套 setup → dispatch → gate → review → fix-loop 链路真实跑通，产物落盘可复现。
- ✅ **gate≠完美**：客观 gate 绿但 review 仍抓出真实 bug（含一个会让功能在旧 Python 上彻底 import 失败的严重问题）——独立评审层有真实价值。
- ✅ **编排流程可行**：5 文件并行实现 + 集成 + 多轮 gate/review 收敛到 ACCEPTED，keep-best 回退机制工作正常。
- ⚠️ **本组不证明"编排比单模型更快/更省"**：同模型下编排多花 203s / 多 2 轮。编排的卖点（用便宜模型群逼近强模型、gen≠review 提质量）**需要 deepseek/国产 fleet 版本才能体现**——见第 5 节待办。

## 5. 待补：真正的 gen≠review 对比（脚本已就绪）

deepseek 经 cc-switch 切换已验证可行（`--model deepseek-v4-pro` 路由成功），仅因当日 deepseek 高峰 529 未跑成。高峰一过，两条命令补齐本报告：

```bash
cd FuguNano/benchmarks/case-a-presets
CLAUDE_MODEL=deepseek-v4-pro ./run-live.sh orchestrated   # deepseek 写 + codex 审 (gen≠review)
CLAUDE_MODEL=deepseek-v4-pro ./run-live.sh single         # deepseek 单模型
```

这组才是 FuguNano 价值主张的核心证据：**国产弱模型（deepseek）经编排后，能否逼近 / 超过单强模型（codex），以及在什么成本下**。补跑后填入下表：

| 方式 | writer | reviewer | gate | 轮数 | 耗时 | 备注 |
|------|--------|----------|------|------|------|------|
| 单模型 | deepseek | — | _待补_ | _待补_ | _待补_ | |
| 编排(gen≠review) | deepseek | codex | _待补_ | _待补_ | _待补_ | |
| 单强模型(参照) | codex | — | ✅ | 1 | 782s | 本报告 §1 |
| 编排(同族,参照) | codex | codex | ✅ | 3 | 985s | 本报告 §1 |

## 6. 复现方式

```bash
cd <FuguNano repo>
benchmarks/case-a-presets/setup.sh                      # clone tqdm@9aff609 + 装依赖 + baseline gate
CODEX=/Applications/Codex.app/Contents/Resources/codex   # 本机 codex CLI
# 复跑本报告的两组：
WRITER=codex benchmarks/case-a-presets/run-live.sh orchestrated
WRITER=codex benchmarks/case-a-presets/run-live.sh single
cat benchmarks/case-a-presets/results-live.csv
```

测试基准固定在 `9aff609`；中间产物在 `work/`（各轮 gate/review log、verdict、diff）。

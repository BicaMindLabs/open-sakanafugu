# Case B — 长链路验证修复任务（commander.js × 3 个关联 bug）

体现 FuguNano **gate → 独立 review → fix loop** 这一核心卖点的对比测试。

## 任务

commander.js（28k★，纯 TS，0 运行时依赖）的参数解析里有 **3 个被注入的关联 bug**
（都在负数处理）：

| Bug | 症状 |
|-----|------|
| B1 | 叶子命令收到 `-3.14` 报错（正则不认小数） |
| B2 | `--offset -5` 拿不到值（optional 漏了负数特判） |
| B3 | `--vals -1 -2` 收集中断（variadic 漏了负数特判） |

目标：修 `lib/command.js`，让 `node --test` 全绿（3 个 caseB 测试转绿 + 不回归）。

## 为什么这套能体现编排优势

- 3 个 bug **高度相似**（都漏了 `negativeNumberArg` 判断）——单模型极容易修好一处、
  漏掉另外两处相似点，然后自信地交付一份没全绿的。
- 有**客观 gate**（`node --test` 红/绿）+ **独立 review**（codex 看盲点），loop 价值天然显现。
- **keep-best**：单模型改 A 破 B 时无回退；编排版能 revert 到最好版本。

## 对比方式

| 方式 | 流程 |
|------|------|
| 编排 | claude 修 → gate(全套测试) → codex 独立 review → keep-best → fix → 循环到绿+ACCEPTED |
| 单模型 | 一个模型一次性修完全部 3 个，自审一次，交 |

## 文件

| 文件 | 作用 |
|------|------|
| `inject-bugs.mjs` | 确定性注入 3 个 bug（源码 drift 会报错） |
| `tests/caseB-bug{1,2,3}.test.js` | 每个 bug 一个针对性测试 |
| `setup.sh` | clone commander + tag clean/buggy + 注入 |
| `gate.sh` | `node --test` 全绿 = PASS |
| `run-live.sh` | 编排 vs 单模型对比（本地 claude+codex） |
| `prompts/` | fix 任务 prompt |

## 跑法

```bash
cd <FuguNano>/benchmarks/case-b-fix
./setup.sh                                   # clone + 注入 + 验证 buggy 状态 3 测试红
CODEX=/Applications/Codex.app/Contents/Resources/codex
WRITER=codex ./run-live.sh orchestrated      # codex 修 + codex 审 + gate + loop
WRITER=codex ./run-live.sh single            # codex 一次性
# claude 网关恢复后:
./run-live.sh orchestrated                   # claude 修 + codex 审 (gen!=review)
cat results-live.csv
```

## 验收口径（公平）

- gate 全绿 = 客观过关。
- codex 独立 review ACCEPTED = 质量过关（防"为过测试而 hack"）。
- 多跑取分布；记录 gate/轮数/耗时。
- keep-best 生效 = 编排独有（单模型无回退）。

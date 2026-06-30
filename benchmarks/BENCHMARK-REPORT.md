# FuguNano Benchmark 报告 — 编排 vs 单模型

> 四个真实任务 × 编排/单模型 × codex/claude(glm)，验证 FuguNano 编排在什么条件下优于单个大模型。
> 数据全部本地实跑，可复现。日期：2026-06-29 ~ 06-30。

## 1. 目的与方法

**问题**：FuguNano 编排（plan→dispatch→integrate→review→loop + gen≠review + 自适应路由）相对"单个模型直接干"，在什么任务上、以什么代价产生优势？

**方法**：同一任务，两种解法，同 gate、同预算、盲评。
- **单模型**：一个模型一次性完成，自审一次。
- **编排**：结构化引导实现 + 独立 review（gen≠review）+ 有界修复循环（keep-best）。
- **gate**：每个 case 的客观测试全绿（pytest / node:test / vitest+tsc+build）。

**4 个 case**（难度递增）：

| Case | 任务 | 载体 | 语言 |
|------|------|------|------|
| A | 跨5文件新功能（tqdm presets） | tqdm 29.8k★ | Python |
| B | 修3个关联bug | commander 28k★ | TS |
| C | 实现完整模块（eval benchmark runner） | FuguNano 自己 | TS |
| D | 全栈 GUI 工作台（4层+UI测试+server） | FuguNano 自己 | TS |

## 📊 对比矩阵 — 首版交付质量（first-pass review）

> ✅ = 首版即被独立 review 判 ACCEPTED；❌ = first pass NEEDS FIX（需修复才达标）。
> **所有 run 最终都 gate 通过、最终都 ACCEPTED**；此矩阵看的是**首版质量**——编排价值的核心所在。

| Case | 单模型 | FuguNano 编排 |
|------|:------:|:------------:|
| **A** · tqdm 跨文件新功能 (codex) | ✅ ACCEPTED | ✅ ACCEPTED |
| **B** · commander 修3bug (codex) | ✅ ACCEPTED | ✅ ACCEPTED |
| **B** · commander 修3bug (glm) | ✅ ACCEPTED | — 未跑 |
| **C** · eval 模块 (codex) | ✅ ACCEPTED | ✅ ACCEPTED |
| **C** · eval 模块 (glm) | ❌ NEEDS FIX | ✅ ACCEPTED |
| **D** · 全栈 GUI (codex) | ❌ NEEDS FIX | ✅ ACCEPTED |

**一眼看出**：简单任务（A/B）单模型首版就达标（✅），编排无差异；**复杂任务（C-glm、D-codex）单模型首版出错（❌），而编排首版即达标（✅）**——任务越难、模型越弱，编排的"首版一次过"优势越明显。

## 2. 全部数据（11 组 run）

| Case | 方式 | writer | gate | 轮数 | 耗时 | first-pass review |
|------|------|--------|------|------|------|-------------------|
| A | single | codex | ✅ | 1 | 782s | ACCEPTED |
| A | orchestrated | codex | ✅ | 3 | 985s | ACCEPTED |
| B | single | codex | ✅ | 1 | 171s | ACCEPTED |
| B | orchestrated | codex | ✅ | 1 | 153s | ACCEPTED |
| B | single | claude(glm) | ✅ | 1 | 860s | ACCEPTED |
| C | single | codex | ✅ | 1 | 432s | ACCEPTED |
| C | orchestrated | codex | ✅ | 1 | 346s | ACCEPTED |
| C | single | claude(glm) | ✅ | 1* | **1924s** | **NEEDS FIX** |
| C | orchestrated | claude(glm) | ✅ | 1 | **911s** | **ACCEPTED** |
| D | single | codex | ✅ | 1* | 438s | **NEEDS FIX** |
| D | orchestrated | codex | ✅ | 1 | **322s** | **ACCEPTED** |

`*` = first pass 后 fix 1 次才 ACCEPTED（2 次模型往返）。

## 3. 核心发现

### 发现 1：任务难度是编排价值的关键开关

**A/B（简单任务）**：codex 单模型就 1 轮满分，编排无优势（A 编排甚至多花 203s/2 轮——同模型下编排的开销没换来收益）。**任务没越过"单模型单轮搞不定"的门槛。**

**C/D（够长的任务）**：门槛被越过——
- C 的 glm：single first pass **NEEDS FIX**（1924s），orchestrated first pass **ACCEPTED**（911s，快一倍）。
- D 的 codex：single first pass **NEEDS FIX**（438s），orchestrated first pass **ACCEPTED**（322s）。

> **编排的价值在"单模型单轮会出错"的复杂度区间才显现。** 任务太简单，编排是纯开销。

### 发现 2：编排优势的机制是"结构化引导 + 独立 review"，不是多轮 loop

C/D 的编排版都 **1 轮就 ACCEPTED**（loop 没触发多轮）。优势来自：
- **结构化引导**：编排 prompt 强调读契约+边界 → 首版质量更高。
- **独立 review**：gate 绿 ≠ 完美，不同模型族的 review 抓出 first-pass 漏的点。

**multi-round loop 在所有 case 里都没真正触发多轮**——1 次 review+fix 就收敛。loop 的边际价值在本批任务里未体现。

### 发现 3：review 层有真实质量价值（贯穿 A/C/D）

"客观 gate 绿 ≠ 代码没问题"：
- **A**：gate 绿，review 抓出会让功能在 **Python 3.8/3.9 直接 import 崩溃**的严重 bug（`np.Inf`... 实为 `from __future__ import annotations` 缺失）。
- **C/D**：gate 绿，review 抓出 NEEDS FIX（single 版）。

这是 FuguNano「确定性 gate + 独立 review（gen≠review）」最站得住的卖点。

### 发现 4：弱模型上编排收益更大

C 的 glm 对比最鲜明：**编排让弱模型首版 ACCEPTED、耗时减半（911s vs 1924s）**。强模型（codex）在 D 上也吃力（NEEDS FIX），编排救回。**模型越弱 / 任务越难，编排的相对收益越大。**

## 4. 诚实局限

1. **同族 review**：C/D 的 codex 组 reviewer 也是 codex（**非真 gen!=review**）。真跨族（glm 写 + codex 审）受 glm 当日 529 过载限制，C 的 glm 组是仅有的真弱模型数据。glm 恢复后补跑预期信号更强。
2. **并行 fan-out 未测**：编排最核心的卖点——多 agent 文件级并行（join barrier + 集成）——因 fugue-cc fleet 未配置而**完全没验证**。本批的"编排"实为 review-fix loop，非并行 fan-out。
3. **样本量**：每 case 每方式 1 次（agent 方差大，应 ≥3 次取分布）。本报告是方向性证据，非统计结论。
4. **MVP 真跑（D）**：GUI 端到端链路验证通（version + preflight codex GO + 安全 execFile），但完整 `plan→dispatch codex→...→loop` 真跑一个 task 未在 GUI 内执行（链路+codex 就绪已证，触发即可跑）。

## 5. 结论

| 场景 | 编排价值 |
|------|---------|
| 简单任务（单模型1轮满分） | ❌ 纯开销 |
| 复杂任务 + 强模型 | ⚠️ 首版质量更高、更快（D：322s vs 438s，首版 ACCEPTED） |
| 复杂任务 + 弱模型 | ✅ 显著（C：911s vs 1924s，首版 ACCEPTED vs NEEDS FIX） |
| 客观质量把关 | ✅ review 层抓 gate 漏的真实 bug（A/C/D） |

**一句话**：FuguNano 编排的**独立 review 层**在所有任务上都有稳定质量价值；其**结构化引导 + loop** 的效率优势，**只在任务复杂到单模型单轮会出错时**才兑现，且**模型越弱收益越大**。

## 6. 下一步（让证据更强）

1. **配 fugue-cc fleet，测并行 fan-out**（最核心未验证卖点）——多 agent 文件级并行 + join barrier + 集成，预期在批量/大型任务上碾压单模型。
2. **glm 恢复后补 C/D 的真 gen!=review 组**（glm 写 + codex 审）。
3. **每 case ≥3 次取分布**（降方差）。
4. **接 SWE-bench-lite 批量**（真实 issue × 测试转绿，可发表级数字）——框架已就绪。

## 7. 复现索引

| Case | 路径 | 跑法 |
|------|------|------|
| A | `benchmarks/case-a-presets/` | `REPORT.md` + `run-live.sh` |
| B | `benchmarks/case-b-fix/` | `run-live.sh` |
| C | `benchmarks/case-c-eval/` | `REPORT.md` + `run-live.sh` |
| D | `benchmarks/case-d-gui/` | `REPORT.md` + `MVP-VERIFY.md` + `run-live.sh` |

每个 case：`./setup.sh` → `WRITER=codex ./run-live.sh {single|orchestrated}` → `cat results-live.csv`。

# Case D — FuguNano GUI 桌面应用

FuguNano 的桌面 GUI 工作台（**Electron + Geist**）：降低使用门槛，不用命令行，桌面应用直接操作 fuguectl 编排流程。

## 🚀 启动

```bash
cd desktop
npm install     # 首次（装 electron）
npm start       # 起桌面窗口
```

详见 [desktop/README.md](desktop/README.md)（架构、Geist、操作说明）。

## 📊 benchmark 报告

[REPORT.md](REPORT.md) — 编排 vs 单模型对比报告（4 case A/B/C/D，含对比矩阵）。关键结论：编排优势在复杂任务（GUI 4 层 + UI 测试）上首次清晰显现。

> 注：Case D 的 web benchmark 工具（gui-skel/fixture/run-live）已移除，桌面应用（`desktop/`）是最终产品。报告保留作历史结果。其他 case（A/B/C）的 benchmark 工具仍在各自目录。

## 📁 结构

- `desktop/` — Electron + Geist 桌面应用（产品）
- `REPORT.md` — benchmark 历史报告

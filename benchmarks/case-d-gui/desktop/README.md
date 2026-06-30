# FuguNano GUI — 桌面应用（Electron + Geist）

FuguNano 的桌面 GUI 工作台：不用命令行，直接在桌面应用里输入/点击执行 fuguectl 编排流程。**Electron 桌面壳 + Geist 设计语言**，主进程直接 exec fuguectl（无需独立 server）。

## 🚀 启动

```bash
cd benchmarks/case-d-gui/desktop
npm install     # 首次（装 electron，约 200MB）
npm start       # 起桌面窗口（prod，加载 dist）
```

开发模式（vite 热重载 + electron）：
```bash
npm run dev
```

窗口打开后：**输入 goal → Plan Task → Dispatch → Integrate → Review → Loop**，每步真调 fuguectl。

## ⏹ 停止
关窗口，或 `pkill -f fugunano-gui-desktop`。

## 🔧 依赖（已硬编码，无需配置）
- **fuguectl**: `orchestration/fuguectl/fuguectl`
- **codex**: `/Applications/Codex.app/Contents/Resources/codex`（主进程自动注入 PATH）

## 🏗 架构

```
desktop/
├── electron/
│   ├── main.cjs       # 主进程: execFile fuguectl(无 shell, 防注入) + IPC(fugue:run/agents)
│   └── preload.cjs    # contextBridge 暴露 window.fugue (contextIsolation 安全)
├── src/               # 渲染进程 (React + Geist)
│   ├── main.tsx       # 入口
│   ├── App.tsx        # Geist UI (goal 输入 + 5 阶段按钮 + Task Log + Agents/Task 面板)
│   ├── bridge.ts      # 调 window.fugue (IPC)
│   ├── geist.css      # Geist tokens (light/dark)
│   └── logic/         # 状态机 + 命令构造 (复用 case-d fixture)
├── index.html · vite.config.ts · tsconfig.json · package.json
└── dist/              # vite build 产物 (electron 加载)
```

**数据流**：UI 事件 → command-builder 构造 fuguectl 命令 → `window.fugue.run(cmd)` → IPC → 主进程 execFile fuguectl → 结果回 workflow-state reducer → UI 更新。

## 🎨 Geist 设计
- 默认 **light 主题**（Geist tokens：高对比、克制色彩、tight radii、subtle elevation）
- 操作型布局（非营销）：左主区（goal/按钮 + Task Log mono 日志）+ 右侧栏（Agents 健康 + Task 元数据）
- 按钮 Verb Noun（`Plan Task`）、focus ring、disabled 状态

## 📝 说明
这是 **Case D 的产品版**（dogfood：用 fuguectl 编排开发的 GUI，本身又操作 fuguectl）。
benchmark 对比用的是 **web 版**（`work/gui/` + `run-live.sh`），与桌面版独立。桌面版聚焦"降低使用者门槛"的产品目标。

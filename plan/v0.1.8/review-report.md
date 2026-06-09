# v0.1.8 评审报告

## 概述

v0.1.8 核心目标是将 Web 应用迁移为 **macOS 桌面应用**。采用 Tauri v2 作为桌面壳，内嵌 FastAPI 后端，打包 Python 依赖 + 音频数据，产出 `.dmg` 安装包。

## 架构

```
┌─────────────────────────────────────────┐
│           97 LISTENING.app              │
│  ┌──────────────────────────────────┐   │
│  │  Tauri v2 (Rust)                 │   │
│  │   └── WKWebView (前端 SPA)        │   │
│  │   └── setup 阶段启动后端子进程     │   │
│  ├──────────────────────────────────┤   │
│  │  Resources/backend/              │   │
│  │   ├── app/         (Python 代码)  │   │
│  │   ├── app/data/lessons/ (音频+JSON│   │
│  │   ├── data/audio.db (SQLite)     │   │
│  │   ├── run.sh       (启动器)      │   │
│  │   └── site-packages/ (Python依赖)│   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 变更内容

### 1. Tauri 桌面壳 (`frontend/src-tauri/`)
- **Rust shell**: `lib.rs` 在 `setup` 阶段自动启动 Python 后端子进程，`Exit` 事件时回收
- **窗口配置**: 1200×800，最小 900×600，开启 `devtools`
- **CSP**: `null`（允许所有网络请求）
- **资源打包**: `backend-bundle/` → `Resources/backend/`
- **Cargo**: `tauri 2.11.2`，启用 `devtools` feature

### 2. 后端打包 (`bundle-backend.sh`)
- 构建前自动将 `backend/{app,data,run.sh}` + `site-packages` 打包进 `backend-bundle/`
- `run.sh` 的 Python 路径改为自动检测（`/usr/bin/python3` → Homebrew → PATH）
- `site-packages` 体积优化：跳过 PyInstaller 等构建工具，移除 stdlib 冲突包

### 3. 启动脚本 (`run.sh`)
- 移除 `set -e`（静默失败问题）
- 多路径 Python 发现：`/usr/bin` → `/usr/local/bin` → `/opt/homebrew` → `$PATH`
- Python 缺失时弹 macOS 对话框提示
- 使用 `exec` 直接替换进程，不留下僵尸进程

### 4. 前端适配
- `api.ts`: 全局 `API_BASE = 'http://127.0.0.1:8000'`（统一后端地址）
- **修复** `audioEngine.ts`: `switchSource` 音频 URL 改为绝对路径（之前用相对路径导致 Tauri 中发到 `tauri://localhost/...`）
- **修复** `App.tsx`: 启动重试机制（指数退避，最多 15 次 ≈ 45 秒等待）
- **修复** `ContentPanel.tsx`: 加载/错误状态可视化
- `CoursesView.tsx` / `ImportView.tsx`: 小幅适配

### 5. 后端修复
- `main.py` CORS: `allow_origins=["*"]`（兼容 Tauri v2 WKWebView 各种 origin 行为）

### 6. 构建工具链
- `scripts/build-mac.sh`: 一键打包脚本
- `Makefile build-mac` target
- 绕开 Tauri 内置 `create-dmg`（在 macOS Sequoia 上不稳定），改用 `hdiutil` 原生命令

## Issues & 解决

| # | 问题 | 根因 | 解决 |
|---|------|------|------|
| 1 | Tauri 内置 bundle_dmg.sh 失败 | create-dmg 的 AppleScript 在新 macOS 不稳定 | 手动 hdiutil 创建 DMG |
| 2 | 前端无数据 | CORS 不匹配 + 启动时序 | `allow_origins=["*"]` + 重试逻辑 |
| 3 | 音频无法播放 | `switchSource` 用了相对路径 | 加上 `API_BASE` 前缀 |
| 4 | DevTools 不可用 | Cargo features 未开启 | `tauri = { features = ["devtools"] }` |

## 清理情况

**已停追踪**（`git rm --cached`）：
- `97 LISTENING.app/` — 旧版 .app bundle（不应进 Git）
- `97 LISTENING.dmg` — 构建产物
- `backend/data/*.db*` — 运行时 SQLite 文件

**已删除**：
- `backend/app/node_modules/` — 后端目录中残留的前端依赖
- `backend/data/english.db*`, `app.db*` — 旧版本遗留数据库
- `scripts/bundle-backend.sh` — 与 `src-tauri/bundle-backend.sh` 重复

**.gitignore 已覆盖**： `.app`, `.dmg`, `*.mp3`, `*.m4a`, `*.db*`, `target/`, `node_modules/`

## 遗留问题

1. **无法离线安装** — 当前打包的是 Python 3.9 编译的 `site-packages`，目标机器必须安装兼容的 `python3`。未来可考虑用 `python-build-standalone` 静态打包 Python 解释器。
2. **Windows/Linux 支持** — 当前仅 macOS（`make build-mac`）。跨平台需额外的打包配置。
3. **Tauri 版本固定** — 当前锁定 `tauri 2.11.2`，升级需验证 `beforeBuildCommand` 和 `resources` 配置兼容性。

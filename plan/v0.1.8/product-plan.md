# v0.1.8 产品计划 — 桌面端迁移

**日期**: 2026-06-08
**主题**: 将 Web 应用打包为 Mac / Windows 桌面应用，保留 Python FastAPI 后端本地服务模式。

---

## 一、技术选型

### 对比方案

| 方案 | 体积 | 技术栈 | Python 后端集成 | 难度 |
|------|------|--------|----------------|------|
| **Tauri 2.0** | ~5-10 MB | Rust + WebView | 侧载 sidecar | 中等 |
| Electron | ~150 MB | Node.js + Chromium | child_process 启动 | 简单 |
| PyWebView | ~30 MB | Python + WebView | 原生 Python | 中等 |

**实际方案：Python FastAPI serve 前端 + macOS .app 启动器**

说明：
- 由于当前网络环境无法下载 Rust/Tauri 依赖，改用轻量级方案
- Python 后端（FastAPI）通过 `StaticFiles` 直接 serve 前端构建产物
- macOS .app 通过 `osacompile` 创建，双击即可启动
- 后端 + 前端 + 浏览器 = 一个 .app 搞定
- 后续网络通畅后可升级到 Tauri

### 架构

```
┌────────────────────────────────────────────┐
│  双击 97 LISTENING.app                     │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  start.command (Shell Script)        │  │
│  │  1. python3 -m uvicorn app.main:app  │  │
│  │  2. open http://localhost:8000       │  │
│  └──────────────────────────────────────┘  │
│              │         │                    │
│              ▼         ▼                    │
│  ┌──────────────┐  ┌──────────────────┐    │
│  │ Python       │  │ Safari/Chrome    │    │
│  │ FastAPI      │←→│ (用户浏览器)      │    │
│  │ :8000        │  │                  │    │
│  │ - API 路由   │  │ Frontend (React) │    │
│  │ - StaticFiles│  │ dist/index.html  │    │
│  └──────────────┘  └──────────────────┘    │
└────────────────────────────────────────────┘
```

---

## 二、关键步骤

### 2.1 安装 Tauri CLI

```bash
# 在 frontend 目录下
npm install --save-dev @tauri-apps/cli@latest
npx tauri init
```

配置 `src-tauri/tauri.conf.json`：
- `identifier`: 应用标识（如 `com.english.app`）
- `windows.title`: "听力练习"
- `build.devUrl`: Vite 开发服务器地址
- `build.frontendDist`: `../dist`

### 2.2 Python Sidecar 配置

在 `tauri.conf.json` 中配置 sidecar：

```json
{
  "bundle": {
    "externalBin": ["binaries/python-backend"]
  }
}
```

sidecar 脚本 `binaries/python-backend`：
- 启动 `uvicorn app.main:app --host 127.0.0.1 --port 8000`
- 在 Tauri Rust 层通过 `tauri::api::process::Command` 管理生命周期

### 2.3 前端适配

- 前端 build 产物放在 `frontend/dist/`
- Tauri 开发模式：`npm run tauri dev`（同时启动 Vite + Tauri 窗口）
- 构建命令：`npm run tauri build`

### 2.4 打包配置

| 平台 | 命令 | 产物 |
|------|------|------|
| macOS | `npm run tauri build` | `.dmg` |
| Windows | `npm run tauri build` | `.msi` 或 `.exe` |
| Linux | `npm run tauri build` | `.deb` / `.AppImage` |

### 2.5 Python 后端打包

Python 后端需要打包为独立可执行文件：

- 使用 **PyInstaller** 将 Python 后端打包为单文件
- macOS: `pyinstaller --onefile app/main.py --name english-backend`
- Windows: 同上（在 Windows 上执行）
- 输出放到 `src-tauri/binaries/` 目录

---

## 三、任务拆分

### 🔴 P0 — 基础搭建

- [x] **3.1 Python 后端 serve 前端**：FastAPI 添加 StaticFiles 挂载 `frontend/dist/`
- [x] **3.2 启动脚本**：`start.command` — 启动后端 + 打开浏览器
- [x] **3.3 macOS .app**：`osacompile` 创建双击可运行的应用程序包

### 🟡 P1 — 跨平台支持

- [ ] **3.4 Windows 启动脚本**：`start.bat` — 启动后端 + 打开浏览器
- [ ] **3.5 PyInstaller 打包**：将 Python 后端打包为独立 exe（可选）
- [ ] **3.6 图标美化**：自定义应用图标

### 🟢 P2 — 后续升级

- [ ] **3.7 Tauri 升级**：网络通畅后迁移到 Tauri 原生窗口
- [ ] **3.8 自动更新**：Sparkle (macOS) / Squirrel (Windows)

---

## 四、注意事项

### 开发环境要求

| 平台 | 依赖 |
|------|------|
| macOS | Xcode CLI tools, Rust (`rustup`), Node.js 18+ |
| Windows | Microsoft Visual Studio Build Tools, WebView2 (Win10+ 内置) |

### Python Sidecar 注意事项

- 确保 `uvicorn` 只监听 `127.0.0.1`（不暴露到外网）
- 应用退出时清理 Python 进程
- Python 进程崩溃时自动重启

### 前端改动

- `vite.config.ts` 中 `server.proxy` 在桌面端不需要（改为直接请求 `127.0.0.1:8000`）
- 或保留 proxy，开发模式和 Tauri 模式使用不同的 base URL

---

## 五、不涉及

- ❌ 功能变更
- ❌ 数据库变更
- ❌ 后端 API 变更
- ❌ UI 重设计

---

## 六、预估

| 优先级 | 模块 | 任务数 | 预估 |
|--------|------|--------|------|
| 🔴 P0 | 基础搭建 | 3 | 0.5 天 |
| 🟡 P1 | Python 集成 | 3 | 1 天 |
| 🟡 P1 | 前端适配 | 2 | 0.5 天 |
| 🟢 P2 | 打包发布 | 3 | 1 天 |
| **合计** | | **11** | **3 天** |

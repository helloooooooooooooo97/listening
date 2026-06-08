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

**推荐：Tauri 2.0**

理由：
- 体积最小（5MB vs Electron 的 150MB）
- macOS 和 Windows 原生窗口，使用系统 WebView（Safari / Edge WebView2）
- 成熟的 sidecar 机制可管理 Python 后端的生命周期
- 安全模型好（无 Node.js 在渲染进程）
- 社区活跃，文档完善

### 架构

```
┌─────────────────────────────────────┐
│  Tauri Desktop App                  │
│                                     │
│  ┌───────────┐  ┌────────────────┐  │
│  │ WebView   │  │ Python Sidecar │  │
│  │ (React    │←→│ (FastAPI       │  │
│  │  Frontend)│  │  localhost:8000)│  │
│  └───────────┘  └────────────────┘  │
│        │                │           │
│  Tauri Core (Rust) ─────┘           │
│  - 启动/停止 sidecar                 │
│  - 窗口管理                          │
│  - 系统托盘                           │
└─────────────────────────────────────┘
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

- [ ] **3.1 安装 Tauri**：添加 `@tauri-apps/cli` 依赖，初始化 `src-tauri`
- [ ] **3.2 Tauri 配置**：`tauri.conf.json` 窗口/标识/权限配置
- [ ] **3.3 开发模式验证**：`npm run tauri dev` 启动桌面窗口

### 🟡 P1 — Python 后端集成

- [ ] **3.4 Sidecar 脚本**：编写启动/停止 Python 后端的脚本
- [ ] **3.5 PyInstaller 打包**：将 Python 后端打包为独立二进制
- [ ] **3.6 Rust 侧 sidecar 管理**：Tauri 命令启动/监控 Python 进程

### 🟡 P1 — 前端适配

- [ ] **3.7 API 地址**：前端请求地址从相对路径改为 `http://127.0.0.1:8000`
- [ ] **3.8 窗口设置**：最小窗口大小、标题栏、系统托盘

### 🟢 P2 — 打包发布

- [ ] **3.9 macOS 打包**：生成 `.dmg` 安装包
- [ ] **3.10 Windows 打包**：在 Windows 环境中生成 `.msi`（交叉编译或在 Windows 上执行）
- [ ] **3.11 签名/公证**：macOS 公证、Windows 代码签名（可选）

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

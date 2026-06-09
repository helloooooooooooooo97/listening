.PHONY: backend frontend dev build clean clear restart install bundle-backend desktop build-mac

# 默认目标：同时启动前后端
dev:
	@echo "🔧 启动后端 API → http://localhost:8000"
	@echo "   API 文档 → http://localhost:8000/docs"
	@cd backend/app && NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 ../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
	@sleep 1
	@echo "🎨 启动前端 → http://localhost:5173"
	@cd frontend && NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm run dev

# 启动后端 API 服务器
backend:
	@echo "🔧 启动后端 API → http://localhost:8000"
	@echo "   API 文档 → http://localhost:8000/docs"
	cd backend/app && NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 ../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 启动前端开发服务器
frontend:
	@echo "🎨 启动前端 → http://localhost:5173"
	cd frontend && NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm run dev

# 安装所有依赖
install: install-backend install-frontend

install-backend:
	@echo "📦 安装后端依赖..."
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -r backend/requirements.txt

install-frontend:
	@echo "📦 安装前端依赖..."
	cd frontend && npm install

# 前端构建
build:
	@echo "🏗️  构建前端..."
	cd frontend && npm run build

# 清理构建产物
clean:
	@echo "🧹 清理..."
	rm -rf frontend/dist
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
	find . -type f -name '*.pyc' -delete 2>/dev/null

# 清空数据库
clear:
	@echo "⚠️  即将清空数据库: backend/data/audio.db"
	@rm -f backend/data/audio.db
	@echo "✅ 数据库已删除，重启后端将自动重建空数据库"

# 重启服务（杀掉旧进程后重新启动）
restart:
	@echo "🔄 停止旧进程..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@sleep 0.5
	@echo "🚀 重新启动..."
	@$(MAKE) dev

# 帮助
help:
	@echo "英语听力 App — 开发命令"
	@echo ""
	@echo "  make dev      同时启动后端和前端（默认）"
	@echo "  make backend  仅启动后端 API"
	@echo "  make frontend 仅启动前端"
	@echo "  make install  安装所有依赖"
	@echo "  make build      构建前端生产版本"
	@echo "  make clean      清理构建产物"
	@echo "  make clear      清空数据库（删除所有记录）"
	@echo "  make restart    杀掉端口进程后重新启动"
	@echo "  make desktop     启动桌面应用 (Tauri dev)"
	@echo "  make build-mac   构建 .dmg 安装包（mac 桌面版）"

# 停止所有服务
stop:
	@echo "🛑 停止后端..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@echo "   ✅ 后端已停止"
	@echo "🛑 停止前端..."
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@echo "   ✅ 前端已停止"
	@echo "🛑 停止 Tauri..."
	@-kill $$(ps aux | grep -i "97 LISTENING.app" | grep -v grep | awk '{print $$2}') 2>/dev/null || true
	@echo "   ✅ Tauri 已停止"
	@echo "✨ 全部已停止"

# 打包后端（将 venv + 代码 + 数据打包进 Tauri .app 的 Resources/）
bundle-backend:
	@echo "📦 后端已配置为 Tauri 目录打包 (tauri.conf.json → resources)"
	@echo "   打包时自动包含: backend/{app,data,.venv,run.sh}"
	@echo "   无需额外步骤。运行 'make desktop' 或 'npx tauri build' 即可"

# 启动桌面应用（Tauri dev 模式）
desktop:
	@echo "🖥️  启动桌面应用..."
	@cd frontend && npx tauri dev

# 构建 macOS 桌面版 .dmg 安装包
build-mac:
	@echo "📦 构建 macOS 桌面版..."
	@bash scripts/build-mac.sh

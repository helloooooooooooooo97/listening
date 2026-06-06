.PHONY: backend frontend dev build clean clear restart install

# 默认目标：同时启动前后端
dev: backend frontend

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

# 清空数据库（删除所有听写记录、播放历史、学习进度、片段收藏等）
clear:
	@echo "⚠️  即将清空数据库: backend/data/audio.db"
	@rm -f backend/data/audio.db backend/data/app.db backend/data/english.db
	@echo "✅ 数据库已删除，重启后端将自动重建空数据库"

# 重启服务（杀死旧进程后重新启动）
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
	@echo "  make build    构建前端生产版本"
	@echo "  make clean    清理构建产物"
	@echo "  make clear    清空数据库（删除所有记录）"
	@echo "  make restart  杀掉端口进程后重新启动"

# 课程导入检查清单 `v0.0.2`

向 App 添加新音频课程的操作步骤。

## 1. 选取音频

- [ ] 从公共领域来源选取短篇英语音频（建议 1-5 分钟）
- [ ] 记录以下元数据：
  - 标题（英文）
  - 副标题（来源/系列名称）
  - 难度等级（A1 / A2 / B1 / B2 / C1）
  - 音频来源 URL
  - 文本来源 URL（如有）

推荐来源：
- [LibriVox](https://librivox.org/) — 公共领域有声书
- [VOA Learning English](https://learningenglish.voanews.com/) — 英语学习新闻
- [Project Gutenberg](https://www.gutenberg.org/) — 公共领域电子书（文本）

## 2. 下载音频

- [ ] 下载 MP3 文件到 `backend/app/data/lessons/`
- [ ] 文件命名：`{lesson-id}.mp3`（用小写字母和连字符，如 `fox-grapes.mp3`）

```bash
curl -L -o backend/app/data/lessons/{lesson-id}.mp3 "DOWNLOAD_URL"
```

## 3. 运行 WhisperX 对齐

- [ ] 确保 `.venv-whisperx/` 环境可用
- [ ] 运行对齐脚本：

```bash
source .venv-whisperx/bin/activate

python tools/align_with_whisperx.py \
  --audio backend/app/data/lessons/{lesson-id}.mp3 \
  --output backend/app/data/lessons/{lesson-id}.json \
  --id {lesson-id} \
  --title "Lesson Title" \
  --subtitle "Source Name, Volume X" \
  --level "A2-B1" \
  --source-url "https://..." \
  --text-source-url "https://..." \
  --model base.en \
  --language en \
  --device cpu
```

- [ ] 等待完成（约 30 秒 - 2 分钟，取决于音频长度和设备）

## 4. 质检 JSON

- [ ] 打开生成的 `{lesson-id}.json`
- [ ] 检查识别错误（专有名词、罕见词汇）
- [ ] 检查句子切分是否合理
- [ ] 检查时间戳是否与音频对齐
- [ ] 检查标点符号
- [ ] 修正明显错误（可选：手动编辑 JSON）

## 5. 添加教学注释（可选）

- [ ] 为关键句子添加 `note` 字段（文化背景、语法要点）
- [ ] 标记值得学习的短语和搭配

## 6. 在 App 中测试

- [ ] 启动后端：`cd backend/app && uvicorn main:app --reload`
- [ ] 验证 API：`curl http://localhost:8000/api/lessons/` 能看到新课程
- [ ] 启动前端：`cd frontend && npm run dev`
- [ ] 在浏览器中播放课程
- [ ] 验证句子高亮和时间同步
- [ ] 验证音频播放正常

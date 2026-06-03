# 双边关系看板

基于 GDELT 结构化新闻事件数据，追踪主要国家双边关系指数，并用 AI 辅助解释趋势变化线索。

## 产品定位

这个项目是一个面向普通读者的双边关系趋势看板。用户可以选择候选国家对，查看 0-100 的关系指数走势，并点击趋势段理解指数变化背后的新闻事件线索。

- 50 为中性
- 高于 50 偏友好
- 低于 50 偏紧张
- 指数反映媒体事件信号，不代表官方外交立场

## 当前支持

候选对象：

- 中国、美国、俄罗斯、欧洲、日本、印度、伊朗、中国台湾、乌克兰

重点关系：

- 中美、中俄、中欧、中日、中印、美伊、美俄、俄乌

## 技术栈

- 前端与 API：Next.js / React / TypeScript
- 数据处理：Python
- 数据库：PostgreSQL，可读取 MapNews 共用数据库，也可由本项目独立导入 GDELT 事件切片
- AI 解读：DeepSeek `deepseek-v4-flash`

## 数据流程

1. 从 `gdelt_events_clean` 读取候选国家对事件。该表既可以来自 MapNews，也可以由本项目独立导入 GDELT 2.0 export 文件生成。
2. 用 GDELT GoldsteinScale 合作/冲突信号计算每日关系指数。
3. 用 14 日滚动平均生成趋势线。
4. 检测趋势段，筛选相关报道线索。
5. 抓取报道网页元信息：标题、描述、canonical，不抓正文。
6. 使用 AI 生成中文趋势摘要、主线和报道短摘要。
7. 写入关系产品缓存表，前端/API 读取缓存展示。

## 环境变量

复制 `.env.example` 到 `.env.local`，并填入本地配置：

```bash
cp .env.example .env.local
```

需要配置：

```bash
GDELT_DATABASE_URL=postgresql://user:password@localhost:5432/mapnews
GDELT_BASE_URL=http://data.gdeltproject.org/gdeltv2
GDELT_RAW_DIR=data/gdelt/raw
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
PYTHON_BIN=.venv/bin/python
```

`.env.local` 不要提交到 GitHub。

## 本地启动

安装依赖：

```bash
npm install
python -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
```

初始化/更新关系产品表：

```bash
.venv/bin/python -m relationship_temperature.precompute
```

如果不依赖 MapNews，可先由本项目独立导入 GDELT 2.0 Events export 文件，再预计算缓存：

```bash
.venv/bin/python -m relationship_temperature.gdelt_importer \
  --date 2026-06-02 \
  --wait-for-files \
  --precompute \
  --with-ai \
  --prune-days 120
```

只测试少量文件时可加：

```bash
.venv/bin/python -m relationship_temperature.gdelt_importer --date 2026-06-02 --limit-files 2 --precompute
```

启动 Web：

```bash
npm run dev -- -p 3001
```

访问：

```text
http://localhost:3001
```

## 每日刷新

如果继续复用 MapNews 导入流程，项目提供每日刷新脚本与 launchd 安装脚本：

```bash
./scripts/install_daily_refresh_launchd.sh
```

刷新任务会等待 MapNews 导入批次满足以下状态后再执行关系指数和 AI 补充：

- `status = success`
- `events_status = success`
- `mentions_status = success`
- `gkg_status = skipped` 或 `success`
- `processing_status = success`
- `files_imported = files_attempted`

若约 1 小时内条件仍不满足，任务会报错退出。

如果生产环境由本项目独立导入 GDELT，推荐定时运行：

```bash
cd /path/to/relationship-temperature
.venv/bin/python -m relationship_temperature.gdelt_importer \
  --wait-for-files \
  --precompute \
  --with-ai \
  --prune-days 120
```

该命令默认导入 UTC 昨日的 96 个 GDELT 2.0 Events export 文件，只保留候选国家代码之间的事件，并写入兼容的 `gdelt_events_clean` 表。

## 测试

前端：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Python：

```bash
.venv/bin/python -m pytest
.venv/bin/python -m mypy relationship_temperature tests
.venv/bin/python -m ruff check relationship_temperature tests
```

## 方法说明

关系指数基于全球新闻报道计算，反映媒体对两国关系的信号，不代表官方外交立场。

指数计算会从 `gdelt_events_clean` 中读取 GDELT 结构化事件，识别合作或冲突信号，并按报道热度加权后映射为 0-100。AI 只用于解释层：根据标题、摘要、趋势段、驱动事件和报道线索生成中文解读，不读取新闻全文，也不把模型输出当作确定因果。

方法参考：

- GDELT 2.0 Event Codebook
- CAMEO 事件编码框架

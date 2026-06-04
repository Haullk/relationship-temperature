# GeoPrizm 双边关系看板

[![Website](https://img.shields.io/badge/Live-geoprizm.com-2563eb?style=flat-square)](https://www.geoprizm.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Data](https://img.shields.io/badge/Data-GDELT-0f766e?style=flat-square)](https://www.gdeltproject.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-111827?style=flat-square)](LICENSE)

GeoPrizm 是一个面向普通读者的国际关系趋势看板。它基于 GDELT 结构化新闻事件数据，把主要国家和地区之间的公开新闻信号转成 0-100 的关系指数，并用中文解释近期趋势变化背后的报道线索。

在线访问：[www.geoprizm.com](https://www.geoprizm.com)

如果你对国际新闻、地缘政治、公共事务数据产品或 GDELT 数据分析感兴趣，欢迎 Star 这个项目，也欢迎通过 Issue 提反馈。

快速入口：

- 在线看板：[www.geoprizm.com](https://www.geoprizm.com)
- 参与贡献：[CONTRIBUTING.md](CONTRIBUTING.md)
- 更新记录：[CHANGELOG.md](CHANGELOG.md)
- 开源协议：[MIT License](LICENSE)

<img width="1162" height="1224" alt="GeoPrizm 双边关系看板截图" src="https://github.com/user-attachments/assets/67b8d104-f3ba-4437-964a-82b747c3ac18" />

## 它解决什么问题

每天的国际新闻很多，但普通读者很难快速判断一组双边关系最近是在改善、恶化还是维持稳定。GeoPrizm 试图把分散的新闻事件整理成一个可读的趋势视图：

- 一分钟内看懂一组关系的当前冷暖
- 查看近 90 天关系指数走势
- 找到明显转折的时间段
- 阅读 AI 辅助生成的中文趋势解释
- 回到具体报道线索，而不是只看一个抽象分数

关系指数的含义：

- `50` 为中性
- 高于 `50` 偏友好
- 低于 `50` 偏紧张
- 指数反映媒体事件信号，不代表官方外交立场

## 当前功能

- 关系指数：基于 GDELT GoldsteinScale 合作/冲突信号计算 0-100 指数
- 趋势图：展示近 90 天走势，并支持切换观察窗口
- 转折点：识别关系变化明显的趋势段
- 新闻线索：展示与趋势变化相关的报道标题、描述和来源链接
- AI 解读：用中文总结趋势主线、关键事件和可能解释
- 候选关系：支持从国家和地区候选池中选择合法关系组合
- 数据缓存：预计算关系产品表，前端/API 读取缓存以提升访问速度

## 支持范围

候选对象：

- 中国
- 美国
- 俄罗斯
- 欧洲
- 日本
- 印度
- 伊朗
- 中国台湾
- 乌克兰

重点关系：

- 中美
- 中俄
- 中欧
- 中日
- 中印
- 美伊
- 美俄
- 俄乌

## 技术栈

- 前端与 API：Next.js / React / TypeScript
- 数据处理：Python
- 数据库：PostgreSQL
- 数据源：GDELT 2.0 Events
- AI 解读：DeepSeek `deepseek-v4-flash`
- 测试：Vitest / pytest / mypy / ruff

## 数据流程

1. 从 `gdelt_events_clean` 读取候选国家对事件。该表既可以来自 MapNews，也可以由本项目独立导入 GDELT 2.0 Events export 文件生成。
2. 用 GDELT GoldsteinScale 合作/冲突信号计算每日关系指数。
3. 用 14 日滚动平均生成趋势线。
4. 检测趋势段，筛选相关报道线索。
5. 抓取报道网页元信息：标题、描述、canonical，不抓正文。
6. 使用 AI 生成中文趋势摘要、主线和报道短摘要。
7. 写入关系产品缓存表，前端/API 读取缓存展示。

## 本地启动

安装依赖：

```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
```

复制环境变量模板：

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

初始化或更新关系产品表：

```bash
.venv/bin/python -m relationship_temperature.precompute
```

启动 Web：

```bash
npm run dev -- -p 3001
```

访问：

```text
http://localhost:3001
```

## 独立导入 GDELT

如果不依赖 MapNews，可由本项目独立导入 GDELT 2.0 Events export 文件，再预计算缓存：

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
.venv/bin/python -m relationship_temperature.gdelt_importer \
  --date 2026-06-02 \
  --limit-files 2 \
  --precompute
```

默认导入 UTC 昨日的 96 个 GDELT 2.0 Events export 文件，只保留候选国家代码之间的事件，并写入兼容的 `gdelt_events_clean` 表。

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

生产环境如果由本项目独立导入 GDELT，推荐定时运行：

```bash
cd /path/to/relationship-temperature
.venv/bin/python -m relationship_temperature.gdelt_importer \
  --wait-for-files \
  --precompute \
  --with-ai \
  --prune-days 120
```

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

## 路线图

- 增加更多国家和地区组合
- 为重点关系提供英文界面
- 增加趋势变化的可解释性指标
- 提供公开更新日志和数据刷新状态页
- 改进分享卡片和 GitHub social preview

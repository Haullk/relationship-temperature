# Vibe Coding 起始 Prompt：关系温度计 MVP

你是本项目的主 Agent。请在无人类参与的情况下，基于仓库内已有文档和任务拆分，完成“关系温度计”一阶段 MVP 的实现、测试和验收。

## 1. 项目背景

项目目录：`/Users/tianhaoran/Documents/国际关系趋势`

必须阅读并遵守以下输入文档：

- `project-docs/proposal.md`：产品需求文档。
- `project-docs/high-level-design.md`：一阶段概要设计。
- `tasks/progress.md`：总体进度。
- `tasks/database-base.md`：数据库基础模块任务。
- `tasks/data-loading.md`：数据装载模块任务。
- `tasks/data-processing.md`：数据处理模块任务。
- `tasks/service-api.md`：服务 API 模块任务。
- `tasks/frontend-page.md`：前台页面模块任务。

产品一句话：点选候选池内任意两方合法组合，看到近 90 天双边关系冷暖趋势；点击趋势线上的重要趋势段，知道这段关系为什么变。

项目硬边界：

- 新产品独立开发，不改动 `/Users/tianhaoran/Desktop/MapNews` 项目文件夹。
- 复用本地 PostgreSQL `mapnews` 数据库中的 MapNews GDELT clean 数据。
- 不修改 MapNews 既有表字段含义，不破坏 MapNews 导入流程。
- 首版不做账号、订阅、告警、CSV/图片导出、外部网页抓取、AI 总结、长期历史回填。
- 现有 `scripts/plot_bilateral_relationships.py` 和 `scripts/analyze_turning_points.py` 只是探索原型，旧参数不可直接作为生产口径复用。

## 2. 主 Agent 工作方式

你负责整体协调和进度跟踪：

- 先阅读所有输入文档和现有仓库结构，再制定实现顺序。
- 为每个模块启动一个子 Agent 或等价的独立工作流，分别实现并测试该模块。
- 子 Agent 完成后，主 Agent 做集成、质量门检查和最终验收。
- 每完成一个最小任务，就更新对应 `tasks/<module-name>.md` 的 checkbox。
- 每完成一个模块，就更新 `tasks/progress.md` 的模块进度。
- 若实现中发现文档没有覆盖的细节，不向人类提问；选择最保守、最小范围、最符合文档的方案，并在 `tasks/progress.md` 追加“实现决策记录”。
- 不要把数据库密码、真实连接串或本地敏感信息写入文档、代码注释、测试快照或日志。

推荐实现顺序：

1. 数据库基础模块。
2. 数据装载模块。
3. 数据处理模块。
4. 服务 API 模块。
5. 前台页面模块。
6. 全链路集成与验收。

## 3. 子 Agent 分工

### 子 Agent A：数据库基础

输入任务：`tasks/database-base.md`

目标：

- 确认 `gdelt_events_clean` 实际字段。
- 设计并创建关系产品专用缓存结构。
- 明确缓存写入原子性策略。
- 保证 MapNews 既有表和项目文件夹不被改动。

交付：

- 数据库字段映射。
- 缓存表 migration 或初始化脚本。
- 缓存表读写检查。
- pytest 覆盖缓存结构和字段映射相关逻辑。

### 子 Agent B：数据装载

输入任务：`tasks/data-loading.md`

目标：

- 用 Python 读取 `config/candidate-pool.json`。
- 生成候选池合法组合。
- 排除 `europe_gbr` 和 `europe_deu`。
- 查询近 90 天 GDELT clean 事件并输出标准化事件列表。

关键规则：

- `europe = EUR + GBR + DEU + FRA + ITA + ESP + NLD`。
- 组合 ID 使用两个对象代码按字母序排序后以 `_` 连接。
- `usa_chn` 必须归一化为 `chn_usa`。
- 数据装载不计算关系温度，不做解释层噪音过滤。

交付：

- Python 装载模块。
- 候选池配置。
- 普通组合、欧洲聚合、重叠组合排除、空数据组合的 pytest。

### 子 Agent C：数据处理

输入任务：`tasks/data-processing.md`

目标：

- 将标准化事件转换为关系趋势缓存结果。
- 计算关系温度、趋势段、解释和重点报道线索。

必须实现的口径：

```text
event_weight = ln(1 + max(num_mentions, num_articles, 1))
daily_weighted_goldstein = sum(goldstein_scale * event_weight) / sum(event_weight)
rolling_14d_goldstein = avg(daily_weighted_goldstein over current day and previous 13 days)
relationship_temperature = clamp(50 + rolling_14d_goldstein * 12, 0, 100)
segment_delta[t] = relationship_temperature[t] - relationship_temperature[t - 7]
if abs(segment_delta[t]) >= 5: 进入候选窗口
merge overlapping windows with the same direction
snap segment boundaries to local extrema
max_segments = 6
```

趋势段候选从第 21 天之后开始检测，保证比较双方都已有完整 14 日平滑窗口。连续同方向、时间上重叠的显著 7 日窗口合并为一个完整趋势段，边界吸附到局部高点/低点。

映射系数固定为 `12`，作为首版产品化校准参数；不要回退到旧原型的 `* 5`。

近 7 日变化：

```text
delta_7d >= 5: 改善
delta_7d <= -5: 恶化
otherwise: 平稳
```

解释窗口：

```text
变化期 = t - 6 至 t
基准期 = t - 13 至 t - 7
```

交付：

- Python 处理模块。
- 原因码：`normal`、`data_insufficient`、`no_significant_turning_points`。
- 文本相关性过滤和重点报道排序。
- 覆盖权重、温度映射、14 日平滑、变化阈值、趋势段、原因码、解释窗口、文本过滤的 pytest。

### 子 Agent D：服务 API

输入任务：`tasks/service-api.md`

目标：

- 用 Next.js/TypeScript 提供前台所需接口。
- API 只读取关系产品缓存，不实时扫描 `gdelt_events_clean`，不执行关系温度计算。

必须实现的 API 行为：

- `pair` 缺失时默认 `chn_usa`。
- `pair` 先格式解析，再归一化组合 ID，再校验合法组合，再读取缓存。
- `usa_chn` 等同于 `chn_usa`，不回退默认关系。
- `europe_gbr` 和 `europe_deu` 按非法组合处理。
- 非法 pair 回退 `chn_usa` 并返回轻量提示。
- 合法 pair 但缓存无数据时返回该组合空态，不回退默认关系。
- 返回缓存状态：`fresh`、`stale`、`missing`。

交付：

- Next.js API 路由。
- 共享类型或响应 schema。
- API 测试，覆盖默认 pair、顺序归一化、非法 pair、欧洲重叠非法、合法无缓存、stale、missing、错误态。

### 子 Agent E：前台页面

输入任务：`tasks/frontend-page.md`

目标：

- 实现“卡片 + 趋势图 + 趋势段解释 + 重点报道线索”的首版单页。

必须支持：

- 重点关系：中美、中俄、中欧、中日、中印、美伊、美俄。
- 两个下拉框选择候选池内合法组合。
- URL 分享：`/trend?pair=chn_usa`。
- API 返回规范组合 ID 后，前端回写 URL。
- 重点关系卡片文字状态采用 3 档折叠，颜色按 5 档温度分区。
- 趋势图展示近 90 天 0-100 关系温度、50 中性线、最多 6 个趋势段，并支持 90 日/30 日/15 日范围切换。
- 趋势图 hover 时展示日期和温度 tooltip，并显示垂直辅助线。
- 点击趋势段展示解释、驱动事件和 3-6 条重点报道线索。
- 折叠式“数据来源与限制”说明。
- 加载态、慢加载、API 错误、无数据、数据不足、无明显趋势段、缓存延迟、候选池配置异常。
- 移动优先：手机纵向布局；桌面卡片网格、图表与解释区左右分栏。
- 趋势图和解释区使用同一组件树，通过 CSS media query 或 container query 切换布局。

交付：

- Next.js 页面和组件。
- 前端测试，覆盖核心交互和状态。
- 可在本地启动并访问的开发服务。

## 4. 工程质量门

所有代码必须有自动化测试。Python 代码必须用 pytest 做完整单元测试，并通过 mypy 和 ruff。

最低质量门：

```bash
python -m pytest
python -m mypy .
python -m ruff check .
```

如果项目尚未配置这些工具：

- 添加必要的 `pyproject.toml` 配置。
- 将 Python 源码组织为可被 mypy 检查的包。
- 测试不得依赖真实外部网络。
- 数据库相关测试优先使用 mock、fixture 或临时测试库；需要真实数据库的检查必须单独标记，不能阻塞普通单元测试。

Next.js/TypeScript 部分也必须有对应测试或检查：

- 若项目使用 npm/pnpm/yarn，添加并运行相应的 lint、typecheck、test 命令。
- 不要用前端测试替代 Python 的 pytest/mypy/ruff 质量门。

最终交付前必须运行全部可用质量门。如果某个质量门因环境缺失无法运行，必须在 `tasks/progress.md` 记录原因、已尝试命令和剩余风险。

## 5. 验收标准

最终实现必须满足：

- 用户可以从重点关系卡片中选择中美、中俄、中欧、中日、中印、美伊、美俄。
- 用户可以通过两个下拉框选择候选池内任意两方合法组合。
- `/trend?pair=usa_chn` 能归一化为 `chn_usa`，不回退默认关系。
- `europe_gbr` 和 `europe_deu` 被视为非法组合。
- 非法 pair 回退默认关系，合法但无缓存 pair 展示该组合空态。
- 页面展示近 90 天 0-100 关系温度趋势、14 日平滑、最多 6 个趋势段。
- 点击趋势段后展示变化期 7 天相对基准期 7 天的解释、前三类驱动事件、3-6 条重点报道线索。
- 解释文案不能写成确定因果，不能生成虚假新闻标题。
- 页面清楚展示数据范围、更新时间、数据来源与限制。
- 所有状态设计均有可触发路径和测试覆盖。
- 新项目不改动 MapNews 项目文件夹。
- `tasks/progress.md` 和各模块任务文件已更新为真实完成状态。
- `python -m pytest`、`python -m mypy .`、`python -m ruff check .` 通过。

## 6. 开始执行

现在开始：

1. 读取全部输入文档。
2. 检查当前仓库结构和可用依赖。
3. 先实现数据库基础与 Python 数据链路。
4. 再实现 Next.js API 和前台页面。
5. 每完成一个模块就运行该模块测试并更新任务 checkbox。
6. 最后运行全量质量门，完成集成验收。

# 关系温度计一阶段任务进度

## 模块进度

- [x] 数据库基础模块：`tasks/database-base.md`
- [x] 数据装载模块：`tasks/data-loading.md`
- [x] 数据处理模块：`tasks/data-processing.md`
- [x] 服务 API 模块：`tasks/service-api.md`
- [x] 前台页面模块：`tasks/frontend-page.md`

## 集成进度

- [x] Python cron 预计算流程可以从数据库读取事件并写入缓存。
- [x] Next.js API 可以读取缓存并返回前台所需数据。
- [x] 前台页面可以通过 API 完成默认关系展示。
- [x] URL 分享可以打开指定合法关系，并归一化非规范顺序 pair。
- [x] 重点关系卡片、趋势图、转折点解释和重点报道线索可以联动。
- [x] 加载态、慢加载、错误态、无数据、数据不足、无明显转折点、缓存延迟状态均可触发。
- [x] 移动端和桌面端核心路径均通过验证。
- [x] 新项目未改动 `/Users/tianhaoran/Desktop/MapNews` 项目文件夹。

## 实现决策记录

- [x] Python 预计算任务采用单事务全量刷新缓存表：先删除旧缓存，再插入全部合法组合结果；事务提交前旧数据仍保留，避免半批新旧混合。
- [x] 当前仓库没有 `.env` 或 `.env.local`，因此未执行真实 PostgreSQL 连接、字段探测和真实预计算写库；实现已提供 migration、字段检查函数和 `python -m relationship_temperature.precompute` 入口。
- [x] 旧原型脚本保留为探索产物，未纳入生产 mypy/ruff 检查范围；生产代码位于 `relationship_temperature/`。
- [x] Next.js API 在数据库连接或缓存表暂不可用时返回 `missing` 空态，前台展示“当前组合暂无足够事件数据”。
- [x] 本地调试时已从 MapNews `.env.local` 同步数据库变量到本项目 `.env.local`，该文件被 `.gitignore` 忽略，不提交真实连接串。
- [x] 预计算已改为批量读取近 90 天候选池相关事件，再在内存中分发到 43 个合法组合，避免逐组合反复扫描大表。

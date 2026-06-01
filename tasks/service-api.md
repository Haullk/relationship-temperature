# 服务 API 模块任务

## 模块目标

用 Next.js/TypeScript 提供前台页面所需接口。API 只读取关系产品缓存，不实时扫描 `gdelt_events_clean`，不执行关系温度计算。

## 最小任务

- [x] 建立 Next.js API 路由结构。
- [x] 明确 `config/candidate-pool.json` 在 Next.js API 端的读取方式。
- [x] 实现候选对象列表接口或响应字段。
- [x] 实现重点关系卡片数据接口或响应字段。
- [x] 实现关系详情接口，支持 `pair` 参数。
- [x] 实现 `pair` 格式解析，要求小写对象代码并以 `_` 连接。
- [x] 实现规范组合 ID：两个对象代码按字母序排序后用 `_` 连接。
- [x] 验证 `/trend?pair=usa_chn` 等同于 `chn_usa`，不回退默认关系。
- [x] 基于 `config/candidate-pool.json` 校验合法组合。
- [x] 将 `europe_gbr` 和 `europe_deu` 按非法组合处理。
- [x] `pair` 缺失时返回默认关系 `chn_usa`。
- [x] `pair` 非法时回退 `chn_usa`，并返回轻量提示。
- [x] `pair` 合法但缓存无数据时返回该组合空态，不回退默认关系。
- [x] 读取缓存表中的趋势点、当前温度、卡片状态、转折点和解释。
- [x] 返回缓存状态：`fresh`、`stale`、`missing`。
- [x] 缓存过期但有旧数据时返回旧数据和 `stale` 状态。
- [x] 缓存缺失且无旧数据时返回 `missing` 状态。
- [x] API 响应不暴露数据库连接信息。
- [x] 编写 API 测试，覆盖默认 pair、顺序归一化、非法 pair、欧洲重叠非法、合法无缓存、stale cache、missing cache、API 错误。

## 完成定义

- [x] 前台页面可以只通过 API 渲染所有首版视图。
- [x] API 不直接扫描 GDELT 原始事件表。
- [x] API 不包含关系温度计算逻辑。
- [x] URL 分享、空态、错误态和缓存延迟状态都有明确响应。


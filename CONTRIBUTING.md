# Contributing to GeoPrizm

感谢你愿意参与 GeoPrizm。这个项目面向普通读者，用结构化新闻事件数据解释双边关系趋势。贡献可以很小：一个数据问题、一处文案改进、一个新的国家组合建议，都有价值。

## 可以贡献什么

- 修复网站或 API 的 bug
- 改进图表、移动端体验和可访问性
- 新增或优化候选国家与地区组合
- 改进 GDELT / CAMEO / GoldsteinScale 相关方法说明
- 补充测试、部署文档或数据刷新流程
- 报告新闻线索、趋势解释或数据质量问题

## 本地启动

```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
cp .env.example .env.local
```

填好 `.env.local` 后初始化缓存：

```bash
.venv/bin/python -m relationship_temperature.precompute
```

启动网站：

```bash
npm run dev -- -p 3001
```

访问 `http://localhost:3001`。

## 提交前检查

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

## 提 Issue

请尽量说明：

- 你看到的问题或想要的改进
- 复现链接、国家组合、日期范围或截图
- 你预期看到什么
- 如果是数据问题，请说明对应报道线索或数据来源

## 提 Pull Request

- 保持改动聚焦，一次 PR 解决一个明确问题
- 不提交 `.env.local`、API key、数据库密码或原始私密数据
- 对行为变化补充测试
- 对数据方法变化补充 README 或文档说明

## 方法边界

关系指数反映公开媒体事件信号，不代表官方外交立场。贡献解释文本、算法或数据筛选逻辑时，请避免把模型输出或单一报道当作确定因果。

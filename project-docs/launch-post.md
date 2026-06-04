# GeoPrizm 发布文案草稿

## 中文长文

标题建议：

```text
我用 GDELT 做了一个国际关系趋势看板：GeoPrizm
```

正文草稿：

```markdown
我做了一个小工具：GeoPrizm。

它基于 GDELT 结构化新闻事件数据，把主要国家和地区之间的公开新闻信号整理成 0-100 的双边关系指数，并用中文解释近期趋势变化背后的报道线索。

在线体验：https://www.geoprizm.com
GitHub：https://github.com/Haullk/relationship-temperature

我做它的原因很简单：每天的国际新闻很多，但普通读者很难快速判断一组双边关系最近是在改善、恶化还是保持稳定。GeoPrizm 试图回答四个问题：

- 当前关系偏友好、偏紧张还是接近中性？
- 近 90 天趋势有没有明显变化？
- 哪些时间段出现了转折？
- 这些变化背后有哪些公开报道线索？

目前支持的重点关系包括：中美、中俄、中欧、中日、中印、美伊、美俄、俄乌。

方法上，指数读取 GDELT 事件数据，用 GoldsteinScale 识别合作或冲突信号，按报道热度加权后映射为 0-100。50 为中性，高于 50 偏友好，低于 50 偏紧张。AI 只用于解释层，根据标题、摘要、趋势段和报道线索生成中文说明，不读取新闻全文，也不把模型输出当作确定因果。

这个项目的边界也很重要：它反映的是媒体事件信号，不代表官方外交立场。

如果你对国际新闻、地缘政治、GDELT、公共事务数据产品或开源看板感兴趣，欢迎试用，也欢迎给 GitHub 点个 Star。最想听到的反馈是：

- 你打开后是否能在一分钟内看懂？
- 哪些关系组合最值得加入？
- 指数和解释哪里不够可信或不够清楚？
```

## V2EX / 即刻短版

```text
做了一个国际关系趋势看板 GeoPrizm：https://www.geoprizm.com

它基于 GDELT 新闻事件数据，把主要国家之间的公开新闻信号转成 0-100 的关系指数，并用中文解释近期趋势变化背后的报道线索。

目前支持中美、中俄、中欧、中日、中印、美伊、美俄、俄乌。

源码开源：https://github.com/Haullk/relationship-temperature

想请大家帮忙看看：第一眼是否能理解它在做什么？哪些关系组合最值得继续加？
```

## Show HN

Title:

```text
Show HN: GeoPrizm, bilateral relationship trends from GDELT news events
```

Comment:

```text
I built GeoPrizm, a public dashboard that tracks bilateral relationship trends from structured GDELT news events.

It maps cooperation and conflict signals into a 0-100 relationship index, detects trend changes, and provides Chinese AI-assisted explanations with report clues. The current focus is on relationships such as China-US, China-Russia, US-Iran, US-Russia, and Russia-Ukraine.

The index reflects media event signals, not official diplomatic positions.

Live demo: https://www.geoprizm.com
Source: https://github.com/Haullk/relationship-temperature

I would especially appreciate feedback on whether the methodology is understandable and whether the dashboard communicates uncertainty clearly enough.
```

## Product Hunt

Tagline:

```text
Track bilateral relationship trends from global news signals
```

Description:

```text
GeoPrizm turns structured GDELT news events into a readable bilateral relationship dashboard, with a 0-100 relationship index, trend segments, report clues, and AI-assisted Chinese explanations.
```

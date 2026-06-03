---
name: "双边关系看板"
description: "面向普通读者的双边关系趋势与解释看板"
colors:
  bg: "#f5f5f5"
  panel: "#ffffff"
  text: "#1f2b33"
  muted: "#667085"
  line: "#e8edf2"
  surface-soft: "#f7f9fb"
  control-soft: "#edf1f5"
  control-track: "#e7ecf1"
  blue: "#4a7fa5"
  red: "#c4403a"
  hot-red: "#c4563b"
  gray: "#9ca3af"
  trend-line: "#374151"
  grid-line: "#c9d2dc"
  success: "#16a34a"
typography:
  headline:
    fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  emphasis:
    fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  caption:
    fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0"
  data:
    fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
rounded:
  control: "6px"
  panel: "8px"
  brand-mark: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  page-x: "18px"
components:
  relation-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "18px"
  range-control:
    backgroundColor: "{colors.control-track}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "3px"
  range-control-active:
    backgroundColor: "{colors.text}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
  select:
    backgroundColor: "#f3f5f7"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "40px"
---

# Design System: 双边关系看板

## 1. Overview

**Creative North Star: "公共事务数据简报"**

这个系统服务一个产品型数据看板，不是营销页，也不是情报大屏。界面应像一份经过编辑的公共事务数据简报：信息密度适中，关系指数和趋势图优先，解释区紧随其后，所有视觉细节都为读者建立信任。

当前系统使用浅灰页面背景、白色信息面板、深墨文字和红蓝灰关系语义。美感来自稳定比例、清晰图表、克制状态色、整齐对齐和细节一致性。后续优化可以增加精致度，但不能牺牲可读性。

**Key Characteristics:**

- 产品型看板，设计服务阅读和判断。
- 色彩克制，红蓝灰只承载关系语义和状态反馈。
- 组件半径小而稳定，面板使用 8px，胶囊只用于分段控制和选择器。
- 文字层级紧凑，数据数字用加粗和等宽数字感建立扫描路径。
- 移动端应优先降低路径长度，而不是简单堆叠桌面模块。

## 2. Colors

调色板以冷静浅灰和白色为底，深墨作为主要文字，蓝色和红色承担关系方向与变化语义。

### Primary

- **Briefing Blue** (#4a7fa5): 用于偏紧张或下降语义、链接、部分图表辅助强调。避免铺满大面积背景。
- **Signal Red** (#c4403a): 用于错误、警示和关系改善方向的当前实现语义。使用时必须配合文字，不单靠颜色表达。

### Secondary

- **Hot Segment Red** (#c4563b): 用于高关系指数、改善趋势段和卡片高温状态。
- **Live Green** (#16a34a): 只用于实时更新点和成功类状态，不进入关系冷暖语义。

### Neutral

- **Canvas Gray** (#f5f5f5): 页面背景，给白色面板提供轻微层次。
- **Panel White** (#ffffff): 主卡片、图表面板、解释面板和方法说明背景。
- **Ink** (#1f2b33): 主文字和选中控件背景。
- **Muted Steel** (#667085): 次级说明文字，必须保持足够对比度。
- **Divider Mist** (#e8edf2): 分隔线和面板内结构线。
- **Data Gray** (#9ca3af): 中性数据、未强调数字和标签。

### Named Rules

**The Semantic Color Rule.** 红、蓝、灰只用于关系语义、状态反馈和图表阅读，不用于纯装饰。

**The No Alarm Wall Rule.** 即使关系恶化，也不要让大面积红色主导屏幕。风险感通过数据和文案表达。

## 3. Typography

**Display Font:** Arial, PingFang SC, Microsoft YaHei, sans-serif  
**Body Font:** Arial, PingFang SC, Microsoft YaHei, sans-serif  
**Label/Mono Font:** 同一字体栈，通过字重和 `font-variant-numeric: tabular-nums` 区分数据。

**Character:** 单一系统 sans 字体适合产品型看板。它应保持熟悉、稳定、低干扰，让数据和解释成为主角。

### Hierarchy

- **Headline** (700, 28px, 1.2): 页面标题和最高层级入口，不使用超大展示字。
- **Title** (700, 20px, 1.25): 面板标题、解释标题和方法小节标题。
- **Emphasis** (700, 16px, 1.35): 国家名、主线事件、卡片关系名和重点列表标题。
- **Body** (400, 14px, 1.65): 解释正文、方法说明和报告摘要。长段落控制在 65-75ch。
- **Caption** (700, 12px, 1.4): 日期、标签、辅助状态和轴标签。
- **Data** (800, 32px, 1): 关系指数、卡片数字和关键变化值。

### Named Rules

**The Product Scale Rule.** 不使用流体大标题。字号固定、层级清楚，避免产品 UI 出现营销页式喊话。

**The Data First Rule.** 关键数字必须可扫读，日期和状态不能抢走指数本身的注意力。

## 4. Elevation

系统使用轻量阴影和浅色层次表达结构。阴影的角色是帮助读者分辨可点击卡片、主要面板和悬停状态，不是制造玻璃质感或漂浮装饰。

### Shadow Vocabulary

- **Soft Panel** (`0 10px 26px rgb(31 41 51 / 7%)`): 主面板、解释区和方法说明的默认层级。
- **Raised Panel** (`0 18px 42px rgb(31 41 51 / 13%)`): 卡片 hover、active 和报告 hover。
- **Control Inset** (`inset 0 1px 2px rgb(31 41 51 / 6%)`): 分段控件和选择器的轻微按压感。

### Named Rules

**The Quiet Elevation Rule.** 默认状态保持平静，只有 hover、focus、active 或当前选中态才提高层级。

## 5. Components

### Buttons

- **Shape:** 普通按钮 6px，分段控制按钮为 pill。
- **Primary:** 当前没有全局主按钮。需要新增时应使用 Ink 背景、Panel White 文本、紧凑高度。
- **Hover / Focus:** 使用轻微阴影、颜色变化和明确 focus-visible。不要只靠 transform。
- **Secondary / Utility:** 分享、重试等工具按钮保持白底、短标签、清楚动词。

### Chips

- **Style:** 关系驱动标签现在是低装饰文本串，用点号分隔。若升级为 chip，应使用浅灰背景和高对比文字，不使用强饱和填充。
- **State:** 选中态必须和非选中态有文字、背景或边框上的明确区别。

### Cards / Containers

- **Corner Style:** 关系卡片和面板使用 8px。不要把卡片圆角推到 24px 以上。
- **Background:** 默认白色，active 关系卡片可以使用语义色轻微 tint。
- **Shadow Strategy:** 默认 Soft Panel，hover 或 active 使用 Raised Panel。
- **Border:** 当前以阴影和背景层次为主。需要边框时使用 Divider Mist，不要加粗彩色侧边条。
- **Internal Padding:** 小卡片 12-14px，主面板 18px，移动端可降到 12px。

### Inputs / Fields

- **Style:** 国家对选择器为 pill select，40px 高，浅灰背景，深墨文字。
- **Focus:** 必须有清楚 focus-visible。未来优化可增加 2px 语义色 outline。
- **Error / Disabled:** disabled 不应只降低透明度，还要保持可读文字和禁用原因。

### Navigation

- **Style:** 当前没有传统导航。顶部是品牌块和实时状态，保持轻量。
- **Mobile:** 顶部信息可换行，实时更新时间不应压缩标题或造成横向溢出。

### Relationship Trend Chart

关系图是签名组件。趋势线、转折段、当前点、坐标标签和解释面板必须保持同一语义体系。图表需要优先服务读者判断：当前值、50 中性线、选中趋势段和日期范围必须一眼可见。

## 6. Do's and Don'ts

### Do:

- **Do** 保持 product register：界面服务判断，不做营销式 hero。
- **Do** 用红、蓝、灰表达关系语义，并始终配套文字。
- **Do** 保持主面板 8px 圆角、18px 桌面内边距、12px 移动端内边距的节奏。
- **Do** 优先优化图表可读性、解释区层级和移动端路径长度。
- **Do** 让美感来自比例、留白、对齐、图表细节和状态一致性。

### Don't:

- **Don't** 做情报机构大屏风：黑底霓虹、作战室视觉、地图墙和警报式红色都不适合。
- **Don't** 做金融终端压迫感：不要让普通读者面对过密数据、闪烁状态和难扫读的小字。
- **Don't** 做 AI 模板卡片风：避免无意义卡片堆叠、套娃卡片、泛用渐变和装饰性胶囊标签。
- **Don't** 使用大面积红色制造紧张感。关系变化靠数据、标题和证据说明。
- **Don't** 使用彩色 `border-left` 粗侧边条作为默认强调方式。
- **Don't** 把移动端做成桌面纵向堆叠的长页面。核心路径必须更短。

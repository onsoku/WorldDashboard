# World Dashboard v1.0

**你的个人百科** — 一个AI驱动的研究仪表盘，通过网络搜索和学术论文调查任何主题，并在交互式仪表盘中展示结果。

[English](../README.md) | [日本語](./README.ja.md) | [Español](./README.es.md) | [Italiano](./README.it.md) | [Français](./README.fr.md)

## 特性

- **AI研究代理** — Claude Code自动搜索网络和学术数据库（Semantic Scholar）
- **交互式仪表盘** — 概述、关键词树形图、带标签页的来源列表
- **落合式论文摘要** — 每篇论文的6点结构化摘要（是什么 / 新颖性 / 方法 / 验证 / 讨论 / 下一步阅读）
- **论文优先** — 学术论文标签页为默认视图，按引用数排序
- **多语言** — UI和生成内容支持英语、日语、中文、西班牙语、意大利语、法语
- **主题切换** — 浅色、深色和黑白主题
- **设置持久化** — 偏好设置保存到localStorage
- **不断增长的知识库** — 每个主题保存在本地，随时可查阅
- **深入导航** — 点击树形图中的关键词、概述中的关键发现或"下一步阅读"建议，即可立即对该主题展开新研究（通过 `meta.parentSlug` 追踪父子关系）
- **导入/导出** — 头部的↓按钮将当前主题导出为JSON；侧栏的↑按钮或拖放JSON文件即可导入
- **灵活架构** — 仅 `meta.topic` 和 `meta.slug` 为必填项，其他字段均可选。扩展系统支持主题特定数据（地图、时间线、表格、图表、简介）
- **富文本展示** — 概述和论文摘要支持Markdown渲染（表格、粗体、标题、列表）。扩展渲染器支持表格、图表（柱状图/折线图/饼图，基于Recharts）和时间线
- **版本管理更新** — 在保留版本历史的同时用最新信息更新现有主题。历史版本完整保留可供浏览。事实发生变化时自动追踪修正
- **文化感知翻译** — 将主题翻译为6种支持语言，自动评估文化差异。超越逐字翻译，在文化语境不同时进行补充网络搜索
- **扩展图表与地图** — 7种图表类型（柱状图、折线图、饼图、面积图、雷达图、散点图、堆叠柱状图）支持多系列。通过Leaflet/OpenStreetMap实现带标记和弹窗的交互式地图

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 6 |
| 样式 | Tailwind CSS 4 |
| Markdown | react-markdown + remark-gfm |
| 图表 | Recharts |
| 地图 | Leaflet + react-leaflet |
| 图标 | Lucide React |
| AI代理 | Claude Code CLI |
| 论文 | Semantic Scholar API（免费）|
| 数据 | 本地JSON文件 |

## 前置条件

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code)（`npm install -g @anthropic-ai/claude-code`）
- Claude Code订阅

## 安装

```bash
git clone git@github.com:onsoku/WorldDashboard.git
cd WorldDashboard
npm install
claude auth login   # 仅首次
npm run dev
```

在浏览器中打开 http://localhost:5173

## 使用方法

1. 点击侧栏的 **"+ 新建"**
2. 输入研究主题
3. 点击 **"开始研究"** — 实时显示进度
4. 完成后仪表盘显示结果
5. 通过侧栏切换历史主题
6. **深入研究** — 点击任意关键词或建议，即可研究相关主题
7. **导出** — 点击头部↓下载主题JSON；**导入** — 点击侧栏↑或拖放JSON文件
8. **更新** — 点击更新按钮（↻）刷新主题为最新信息
9. **翻译** — 点击翻译按钮将主题转换为其他语言
10. 通过 ⚙️ 图标更改主题和语言

## 许可证

MIT

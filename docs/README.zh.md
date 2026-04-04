# World Dashboard

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

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 6 |
| 样式 | Tailwind CSS 4 |
| 图表 | Recharts |
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
6. 通过 ⚙️ 图标更改主题和语言

## 许可证

MIT

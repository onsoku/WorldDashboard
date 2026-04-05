# World Dashboard

**Your Personal Encyclopedia** — An AI-powered research dashboard that investigates any topic using web search and academic papers, then displays the results in an interactive dashboard.

[日本語](./docs/README.ja.md) | [中文](./docs/README.zh.md) | [Español](./docs/README.es.md) | [Italiano](./docs/README.it.md) | [Français](./docs/README.fr.md)

## Screenshots

### Light Theme
![Light Theme](./docs/screenshots/light-overview.png)

### Dark Theme
![Dark Theme](./docs/screenshots/dark-overview.png)

### Monochrome Theme
![Monochrome Theme](./docs/screenshots/mono-overview.png)

### Keyword Map & Sources
![Keywords](./docs/screenshots/light-keywords.png)

### English UI
![English](./docs/screenshots/light-english.png)

## Features

- **AI Research Agent** — Claude Code automatically searches the web and academic databases (Semantic Scholar) for any topic
- **Interactive Dashboard** — Overview, keyword treemap, source list with tabs
- **Ochiai-style Paper Summaries** — Structured 6-point summary for each paper (What / Novelty / Method / Validation / Discussion / Next)
- **Papers First** — Academic papers tab default, sorted by citation count
- **Multi-language** — UI and generated content in English, Japanese, Chinese, Spanish, Italian, French
- **Theme Switching** — Light, Dark, and Monochrome themes
- **Persistent Settings** — Preferences saved to localStorage
- **Growing Knowledge Base** — Topics saved locally and revisitable anytime
- **Drilldown Navigation** — Click any keyword in the treemap, key finding in overview, or "next paper" suggestion to instantly start a new research on that topic (parent-child tracking via `meta.parentSlug`)
- **Import/Export** — Export button (↓) in header downloads current topic as JSON; import button (↑) in sidebar or drag & drop JSON files onto the topic list
- **Flexible Schema** — Only `meta.topic` and `meta.slug` are required; all other fields optional. Extensions system for theme-specific data (map, timeline, table, chart, profile)
- **Rich Display** — Markdown rendering (tables, bold, headings, lists) in overview and paper summaries. Extension renderers for table, chart (bar/line/pie via Recharts), and timeline

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Styling | Tailwind CSS 4 |
| Markdown | react-markdown + remark-gfm |
| Charts | Recharts |
| Icons | Lucide React |
| AI Agent | Claude Code CLI |
| Papers | Semantic Scholar API (free) |
| Data | Local JSON files |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- Claude Code subscription

## Setup

```bash
git clone git@github.com:onsoku/WorldDashboard.git
cd WorldDashboard
npm install
claude auth login   # first time only
npm run dev
```

Open http://localhost:5173

## Usage

1. Click **"+ New"** in the sidebar
2. Enter a research topic
3. Click **"Start Research"** — progress shown in real-time
4. Dashboard displays results when complete
5. Switch between past topics in the sidebar
6. **Drilldown** — Click any keyword or suggestion to research a related topic
7. **Export** — Click ↓ in the header to download a topic as JSON; **Import** — Click ↑ in the sidebar or drag & drop JSON files
8. Change theme/language via the ⚙️ icon

## Project Structure

```
WorldDashboard/
├── .claude/skills/research/   # AI research skill definition
├── server/research-api.ts     # Backend API (Vite middleware)
├── public/data/               # Generated research data (JSON)
├── src/
│   ├── components/            # React UI components
│   ├── context/               # Settings context (theme + language)
│   ├── hooks/                 # Data loading hooks
│   ├── i18n/                  # Translations (6 languages)
│   └── types/                 # TypeScript interfaces
└── docs/                      # Translated READMEs
```

## License

MIT

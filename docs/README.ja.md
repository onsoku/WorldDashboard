# World Dashboard

**自分で作る辞典** — 指定したテーマについてAIエージェントがWeb検索と学術論文検索を行い、結果をインタラクティブなダッシュボードに表示します。

[English](../README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [Italiano](./README.it.md) | [Français](./README.fr.md)

## 特徴

- **AI調査エージェント** — Claude CodeがWebと学術データベース(Semantic Scholar)を自動検索
- **インタラクティブダッシュボード** — 概要、キーワードTreemap、ソース一覧をタブ切替
- **落合陽一式論文要約** — 各論文に6項目の構造化要約（どんなもの？/ 新規性 / 手法 / 検証 / 議論 / 次に読むべき論文）
- **論文優先表示** — 学術論文タブがデフォルト、引用数順ソート
- **多言語対応** — UI・生成コンテンツが英語、日本語、中国語、スペイン語、イタリア語、フランス語に対応
- **テーマ切替** — ライト、ダーク、モノクロの3テーマ
- **設定永続化** — テーマ・言語設定をlocalStorageに保存
- **成長するナレッジベース** — 各トピックをローカルに保存、いつでも参照可能

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 18 + TypeScript + Vite 6 |
| スタイリング | Tailwind CSS 4 |
| チャート | Recharts |
| アイコン | Lucide React |
| AIエージェント | Claude Code CLI |
| 論文検索 | Semantic Scholar API (無料) |
| データ | ローカルJSONファイル |

## 前提条件

- [Node.js](https://nodejs.org/) 18以上
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- Claude Codeサブスクリプション

## セットアップ

```bash
git clone git@github.com:onsoku/WorldDashboard.git
cd WorldDashboard
npm install
claude auth login   # 初回のみ
npm run dev
```

ブラウザで http://localhost:5173 を開く

## 使い方

1. サイドバーの **「+ 新規」** をクリック
2. 調査テーマを入力
3. **「調査を開始」** をクリック — 進捗がリアルタイム表示
4. 完了後、ダッシュボードに結果が表示される
5. サイドバーから過去のトピックに切替可能
6. ヘッダーの ⚙️ アイコンからテーマ・言語を変更

## ライセンス

MIT

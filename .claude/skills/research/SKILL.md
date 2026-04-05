---
name: research
description: 指定テーマについてWeb検索と学術論文検索を行い、ダッシュボード用JSONデータを生成する調査スキル
user_invocable: true
---

# Research Skill - テーマ調査

ユーザーが指定したテーマについてWeb検索と学術論文検索を行い、ダッシュボード表示用のJSONデータを生成します。

## 引数

ユーザーメッセージから調査テーマを抽出してください。例: `/research quantum computing`, `/research 気候変動と農業`

## 実行手順

### Phase 1: テーマ解析と準備

1. ユーザーメッセージから調査テーマを抽出する
2. テーマからURL安全なslugを生成する（小文字、ハイフン区切り、英数字のみ。日本語テーマの場合はローマ字または英訳を使う）
3. テーマに基づいて3〜5個の異なる検索クエリを生成する（異なる角度・側面をカバー）

### Phase 2: Web検索

1. WebSearchツールを使って、Phase 1で生成した各クエリで検索を実行する（3〜5回）
2. 検索結果から重複を除去し、10〜15件のユニークなWebソースを収集する
3. 重要そうな結果にはWebFetchツールを使ってより詳細な情報を取得する
4. 各ソースを以下のタイプに分類する: "news", "blog", "organization", "government", "encyclopedia", "other"

### Phase 3: 学術論文検索

1. 2〜3個のクエリバリエーションについて、以下のURLをWebFetchで呼び出す:

```
https://api.semanticscholar.org/graph/v1/paper/search?query={URLエンコードしたクエリ}&limit=10&fields=title,abstract,year,authors,url,citationCount,openAccessPdf,venue
```

2. WebFetchのpromptには「Return the complete JSON response exactly as-is」と指定する
3. レスポンスのJSON（`data`配列）からpaperIdで重複を除去する
4. 15〜20件のユニークな論文を収集する
5. authorsフィールドは `[{authorId, name}]` 形式なので、`name`だけを抽出してstring[]にする
6. openAccessPdfフィールドは `{url, status}` または null なので、`url`を抽出する

### Phase 4: 分析・統合

収集したデータに基づいて以下を生成する:

1. **概要 (summary)**: テーマについて2〜4段落の包括的な概要を日本語で作成。改行で段落を区切る
2. **主要な発見 (keyFindings)**: 5〜8個の重要なポイントを箇条書きで
3. **重要性 (significance)**: このテーマがなぜ重要かを1段落で
4. **キーワード (keywords)**: 15〜25個のキーワードを抽出し、各キーワードに:
   - `term`: キーワード名
   - `relevance`: 1〜100の関連度スコア
   - `category`: "concept" | "method" | "technology" | "entity" | "outcome" のいずれか
   - `relatedTerms`: 関連する用語2〜4個
5. **統計 (statistics)**:
   - `totalWebSources`: Webソース数
   - `totalPapers`: 論文数
   - `yearRange`: 論文の年範囲 `{min, max}`
   - `topAuthors`: 頻出著者名（最大5人）
6. **落合陽一式論文要約 (ochiaiSummary)**: 各論文のabstractから以下の6項目を日本語で生成する:
   - `what`: この論文は何についてか（1-2文）
   - `novelty`: 先行研究と比べて何が新しいか（1-2文）
   - `method`: 技術や手法のキモは何か（1-2文）
   - `validation`: どうやって有効性を検証したか（1-2文）
   - `discussion`: 議論すべき点は何か（1-2文）
   - `next`: 次に読むべき関連論文は何か（論文名1-2個）

### Phase 5: JSONファイル出力

以下のスキーマに準拠したJSONオブジェクトを構成する。

**必須フィールド**: `meta.topic` と `meta.slug` のみ。他のフィールドはすべてオプションだが、可能な限り全フィールドを生成すること。

```json
{
  "meta": {
    "topic": "テーマ名（日本語）",
    "slug": "theme-slug",
    "createdAt": "ISO 8601形式",
    "queryTerms": ["使った検索クエリ一覧"]
  },
  "overview": {
    "summary": "概要テキスト",
    "keyFindings": ["発見1", "発見2"],
    "significance": "重要性の説明"
  },
  "keywords": [
    { "term": "...", "relevance": 90, "category": "concept", "relatedTerms": ["...", "..."] }
  ],
  "webSources": [
    { "title": "...", "url": "...", "snippet": "...", "sourceType": "organization", "retrievedAt": "ISO 8601" }
  ],
  "academicPapers": [
    {
      "paperId": "...", "title": "...", "authors": ["name1", "name2"], "year": 2025, "abstract": "...", "url": "...", "citationCount": 100, "openAccessPdfUrl": "..." or null, "venue": "...",
      "ochiaiSummary": {
        "what": "この論文は何についてか（1-2文）",
        "novelty": "先行研究と比べて何が新しいか（1-2文）",
        "method": "技術や手法のキモは何か（1-2文）",
        "validation": "どうやって有効性を検証したか（1-2文）",
        "discussion": "議論すべき点は何か（1-2文）",
        "next": "次に読むべき関連論文は何か（論文名1-2個）"
      }
    }
  ],
  "statistics": {
    "totalWebSources": 10,
    "totalPapers": 15,
    "yearRange": { "min": 2020, "max": 2026 },
    "topAuthors": ["Author1", "Author2"]
  },
  "extensions": {
    "任意のキー": { "type": "map | timeline | table | chart | profile", "..." : "..." }
  }
}
```

#### extensions フィールド（オプション）

テーマに応じて、以下の拡張データを `extensions` に追加できる。UIは対応するレンダラーがあれば表示し、なければ無視する。

| type | 用途 | 主要フィールド |
|------|------|---------------|
| `map` | 地理的テーマ | `locations: [{name, lat, lng, description?}]` |
| `timeline` | 歴史的テーマ | `events: [{date, title, description?}]` |
| `table` | データ比較 | `headers: string[], rows: string[][]` |
| `chart` | 統計可視化 | `chartType: "bar"|"line"|"pie", labels, data` |
| `profile` | 人物テーマ | `name, image?, bio?, links?` |

1. Writeツールを使って `public/data/{slug}.json` にJSONを書き出す
2. Readツールで `public/data/index.json` を読む
   - ファイルが存在する場合: JSONをパースし、`topics`配列に新しいエントリを追加（同じslugがあれば上書き）
   - ファイルが存在しない場合: 新しいindexを作成
3. Writeツールで `public/data/index.json` を書き戻す

新しいトピックエントリの形式:
```json
{ "slug": "theme-slug", "topic": "テーマ名", "createdAt": "ISO 8601" }
```

### Phase 6: 完了レポート

ユーザーに以下を報告する:
- 収集したWebソース数
- 収集した学術論文数
- 抽出したキーワード数
- 「ダッシュボード (http://localhost:5173) を更新してください」

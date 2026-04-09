---
name: research
description: 指定テーマについてWeb検索と学術論文検索を行い、ダッシュボード用JSONデータを生成する調査スキル
user_invocable: true
---

# Research Skill - テーマ調査

ユーザーが指定したテーマについてWeb検索と学術論文検索を行い、ダッシュボード表示用のJSONデータを生成します。

## この辞典の存在意義

この辞典は、単なる用語集や読み物ではなく、**未知のテーマを短時間で理解し、位置づけを把握し、次の調査や判断につなげるための知識基盤**である。各ページは以下の3点を満たすこと:

1. **そのテーマが何であるかを理解できること** — 概要・背景・主要な要素を通じて、初見でも全体像をつかめる状態にする
2. **そのテーマが他とどう関係するかを把握できること** — 関連概念・歴史・比較・位置づけを通じて、文脈の中で理解できる状態にする
3. **そのテーマについて次に何を調べるべきか判断できること** — 重要論点・争点・主要キーワード・参考資料を通じて、追加調査や実務判断に進める状態にする

**AI向け設計原則:**
- ページは説明ではなく理解支援である
- ページは孤立した知識ではなく文脈を持つ
- ページは読了で終わらず次の調査につながる

## 引数

ユーザーメッセージから調査テーマを抽出してください。例: `/research quantum computing`, `/research 気候変動と農業`

## 実行手順

### Phase 0: 更新モード判定（UPDATE MODEの場合のみ）

システムプロンプトに「=== UPDATE MODE ===」が含まれている場合、これは既存辞典の更新です:

1. 「=== EXISTING DATA ===」セクションの既存データを分析する
2. 既存の概要・キーワード・ソースを把握する
3. 以降のPhaseでは **既存データに追加・補完する形** で調査を行う
4. 既に収集済みのWebソースや論文と重複しない新しい情報を優先する
5. 以前の記述に誤りがあれば `corrections` 配列に記録する:
   ```json
   "corrections": [
     { "target": "訂正対象", "old": "以前の記述", "new": "正しい情報", "reason": "訂正理由" }
   ]
   ```
6. システムプロンプトで指定された `versions` 配列をそのまま出力JSONに含める
7. 既存の slug を維持する（新しいslugを生成しない）

### Phase 1: テーマ解析と構成計画

1. ユーザーメッセージから調査テーマを抽出する
2. テーマからURL安全なslugを生成する（小文字、ハイフン区切り、英数字のみ。日本語テーマの場合はローマ字または英訳を使う）
3. テーマに基づいて3〜5個の異なる検索クエリを生成する（異なる角度・側面をカバー）
4. **構成計画**: テーマの性質を分析し、summaryに含めるべきセクション構成を計画する。以下の3つの観点を必ず満たすこと:
   - **理解**: そのテーマが何であるかを初見でも全体像をつかめるセクション
   - **位置づけ**: そのテーマが他とどう関係するか、文脈の中で理解できるセクション
   - **次の行動**: 次に何を調べるべきか判断できるセクション（重要論点・争点・参考キーワード）

   テーマの性質に応じて構成は変えてよい。例:
   - 技術テーマ → 「原理」「主要プレイヤー比較」「応用分野」「未解決の課題と今後の方向」
   - 地政学テーマ → 「背景と経緯」「各国の立場」「影響と波及」「今後の注目ポイント」
   - 食文化テーマ → 「歴史と成り立ち」「地域差と特徴」「代表的な料理」「文化的文脈と世界への影響」
   - 概念テーマ → 「定義と背景」「構成要素」「類似概念との比較」「実務への適用と課題」

### Phase 2: Web検索

1. WebSearchツールを使って、Phase 1で生成した各クエリで検索を実行する（3〜5回）
2. 検索結果から重複を除去し、10〜15件のユニークなWebソースを収集する
3. WebFetchは本当に詳細が必要なソースにのみ使う（最大3件）。検索snippetで十分な情報がある場合はfetch不要
4. 各ソースを以下のタイプに分類する: "news", "blog", "organization", "government", "encyclopedia", "other"

### Phase 3: 学術論文検索

1. メインクエリで `limit=20` を使い、1回のAPI呼び出しで多くの論文を取得する:

```
https://api.semanticscholar.org/graph/v1/paper/search?query={URLエンコードしたクエリ}&limit=20&fields=title,abstract,year,authors,url,citationCount,openAccessPdf,venue
```

2. メインクエリで十分な論文（15件以上）が得られない場合のみ、追加の角度でもう1回検索する（合計最大2回）
3. WebFetchのpromptには「Return the complete JSON response exactly as-is」と指定する
4. レスポンスのJSON（`data`配列）からpaperIdで重複を除去する
5. 15〜20件のユニークな論文を収集する
6. authorsフィールドは `[{authorId, name}]` 形式なので、`name`だけを抽出してstring[]にする
7. openAccessPdfフィールドは `{url, status}` または null なので、`url`を抽出する

### Phase 4: 分析・統合

収集したデータに基づいて以下を生成する:

1. **概要 (summary)**: Phase 1で計画した構成に基づき、テーマの辞典ページをMarkdown形式で作成する。
   - Phase 1の構成計画に沿ったセクション構成で、見出し（`##` `###`）を使って構造化する
   - **太字**や`コード`で重要な用語を強調
   - **比較表**（GFM形式のMarkdownテーブル）で複数の要素を比較
   - 箇条書きや番号付きリストで情報を整理
   - 数値データがあれば表にまとめる
   - 単なる説明文にせず、**理解するために必要な観点**と**次の調査につながる導線**を含める
   - 最後のセクションとして「次に調べるべきテーマ」を箇条書きで含める
   - 目安: 1500〜3000文字程度、表2〜3個を含む
2. **主要な発見 (keyFindings)**: 5〜8個の重要なポイントを箇条書きで
3. **重要性 (significance)**: このテーマがなぜ重要かを1段落で。Markdown太字で強調可
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
    "summary": "構成計画に基づいたテーマの辞典ページ（Markdown形式、1500〜3000文字）",
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
    "任意のキー": { "type": "map | timeline | table | chart | profile | diagram", "..." : "..." }
  }
}
```

#### extensions フィールド（積極的に生成すること）

テーマに応じて、以下の拡張データを `extensions` に追加する。**最低1つ、できれば2〜3個のextensionを生成すること。** UIは対応するレンダラーがあれば表示し、なければ無視する。

**必須: 全extensionに `title` と `description` を付けること。**
- `title`: 日本語の表示名（例: `"主要企業の量子プロセッサ比較"`）。キー名ではなくこのtitleがUIに表示される
- `description`: 何を示しているか・読み取りポイントの簡潔な説明（Markdown対応）

| type | 用途 | 主要フィールド |
|------|------|---------------|
| `table` | データ比較・一覧 | `headers: string[], rows: string[][]` |
| `chart` | 統計可視化 | `chartType: (下記参照), labels: string[], data: number[] \| {name,values}[]` |
| `timeline` | 歴史的テーマ | `events: [{date, title, description?}]` |
| `map` | 地理的テーマ | `locations: [{name, lat, lng, description?}]` |
| `profile` | 人物テーマ | `name, image?, bio?, links?` |
| `diagram` | 構成図・概念図 | `svg: string`（SVGマークアップ文字列） |

**chartType一覧:**
| chartType | 用途 | data形式 |
|-----------|------|---------|
| `bar` | カテゴリ比較 | `number[]` |
| `line` | 時系列推移 | `number[]` or `{name, values}[]` |
| `pie` | 構成比 | `number[]` |
| `area` | トレンド（塗りつぶし） | `number[]` or `{name, values}[]` |
| `radar` | 多軸比較（国力、性能等） | `number[]` or `{name, values}[]` |
| `scatter` | 相関関係 | `{name, values}[]`（2系列: x,y） |
| `stackedBar` | 構成比の推移 | `{name, values}[]` |

**複数系列の例:**
```json
{ "type": "chart", "chartType": "stackedBar", "labels": ["2020", "2021", "2022"],
  "data": [{"name": "太陽光", "values": [10, 15, 22]}, {"name": "風力", "values": [8, 12, 18]}] }
```

**extension選択ガイド:**
- 数値データや統計がある → `chart`
- 複数の項目を比較する → `table`
- 時系列の出来事がある → `timeline`
- 地域や場所に関連する → `map`（緯度経度を必ず含める）
- 人物が主題 → `profile`
- 国や技術の多軸比較 → `chart` (radar)
- 地政学・紛争・貿易 → `map` + `chart` を組合せ
- システム構成・アーキテクチャ・概念関係図 → `diagram`

**diagram extensionの注意:**
- `svg`フィールドにSVGマークアップ文字列を直接記述する
- SVGは `<svg xmlns="http://www.w3.org/2000/svg" viewBox="..." >` で始めること
- テキストの色は `currentColor` を使うとテーマに追従する
- 背景は透明にして親要素に任せる
- 矢印・ボックス・ラベルを使ったシンプルで読みやすい図を心がける
- `<script>` タグや `on*` イベント属性は使用禁止（サニタイズで除去される）
- 図が複雑になりすぎる場合は `table` で代替する（図はあくまで補助）

**例: "再生可能エネルギー"の場合**
```json
"extensions": {
  "energyMix": { "type": "chart", "chartType": "pie", "title": "世界のエネルギーミックス構成比", "description": "再生可能エネルギー源別の発電量シェア。太陽光が最大の35%を占める", "labels": ["太陽光", "風力", "水力", "地熱", "バイオマス"], "data": [35, 28, 20, 10, 7] },
  "comparison": { "type": "table", "title": "再生可能エネルギー源の比較", "description": "コスト・排出量・設備利用率の観点から各エネルギー源を比較", "headers": ["エネルギー源", "コスト", "CO2排出量", "設備利用率"], "rows": [["太陽光", "低", "ゼロ", "15-20%"], ["風力", "低", "ゼロ", "25-45%"]] },
  "history": { "type": "timeline", "title": "再生可能エネルギーの歴史", "description": "太陽電池の発明から現代の洋上風力まで、主要なマイルストーン", "events": [{"date": "1954", "title": "ベル研究所が太陽電池を発明"}, {"date": "1991", "title": "デンマークが洋上風力を開始"}] }
}
```

**例: "地政学テーマ"の場合**
```json
"extensions": {
  "locations": { "type": "map", "title": "主要都市の位置", "description": "関連する首都・主要都市の地理的分布", "locations": [{"name": "東京", "lat": 35.68, "lng": 139.69, "description": "首都"}, {"name": "ワシントンDC", "lat": 38.89, "lng": -77.04, "description": "米国首都"}] },
  "powerIndex": { "type": "chart", "chartType": "radar", "title": "国力指数の多軸比較", "description": "米中の軍事・経済・外交・技術・人口の5軸での総合比較", "labels": ["軍事力", "経済力", "外交", "技術", "人口"], "data": [{"name": "米国", "values": [95, 90, 85, 92, 70]}, {"name": "中国", "values": [80, 88, 75, 85, 95]}] }
}
```

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

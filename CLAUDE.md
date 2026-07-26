# CLAUDE.md

World Dashboard — Claude Code 向けのリポジトリ指示書。
実装に入る前にここを読むこと。ここに書かれた不変条件は、過去に実害を出した障害の再発防止として設けられている。

## このプロジェクトは何か

任意のテーマについて Claude Code CLI が Web 検索と学術論文検索を行い、
結果を JSON として書き出して React ダッシュボードで閲覧する「自分で作る辞典」。

- フロントエンド: React 19 + TypeScript + Vite + Tailwind CSS 4
- バックエンド: Vite の `configureServer` プラグイン (`server/research-api.ts`)
- 調査エンジン: `claude` CLI をサブプロセス起動し、`--output-format stream-json` をパース
- データ: `public/data/{slug}.json`（実データ）と `public/data/index.json`（目次）。いずれも gitignore

## アーキテクチャの不変条件

破ると過去の障害が再発する。変更する場合は理由をここに追記すること。

### 1. `index.json` はサーバだけが書く

Claude CLI に `index.json` を触らせてはいけない。

以前は各 CLI サブプロセスが `index.json` を read-modify-write していた。
3並列で実行すると last-write-wins になり、他ジョブが追加したエントリが消える
（[#26](https://github.com/onsoku/WorldDashboard/issues/26)。データファイルは残るのに目次に載らない
[#25](https://github.com/onsoku/WorldDashboard/issues/25) の症状も同じ原因）。

現在の設計:

- CLI へのシステムプロンプトに「`index.json` を読み書きするな」と明示している
- CLI が書いたのを検出したら `cli.wrote_index` を warn ログに出す
- 更新は `server/index-writer.ts` の `updateIndex()` / `removeFromIndex()` のみが行い、
  promise-chain の mutex で直列化される
- `index.json` の読み込みに失敗したら**throw する**。空配列で上書きしてはいけない

### 2. `finalizeJob()` がジョブ終了の唯一のフック

`server/research-api.ts` の `finalizeJob()` だけが以下を行う。

- 終了ログ (`job.exit`) の出力
- `updateIndex()` の呼び出し
- `flushJob()` によるジョブ状態の永続化

`result` イベントのハンドラで `markDone()` を呼んだり index を更新したりしないこと。
サブプロセスの `close` を待って `finalizeJob()` に一本化する。

### 3. slug は必ず共通の検証を通す

`server/slug.ts` の `isValidSlug()` / `resolveDataPath()` を使う。
slug からファイルパスを組み立てる箇所を新設する場合も同様。

`/api/import` だけ検証が無く、アップロードした JSON の `meta.slug` で
データディレクトリ外に書き込めた（[#35](https://github.com/onsoku/WorldDashboard/issues/35)）。
現在は import / delete / repair / export-pdf / translate / research の全てが同じ関数を通る。

### 4. 生成コンテンツは無害化してから描画する

`extensions` の SVG と Markdown 内の生 HTML は、Web 検索結果を経由した LLM 出力であり信頼できない。

- SVG: `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject'] })`
- Markdown: `rehypeRaw` の**後段**に `rehypeSanitize` を置く（`rehypeRaw` は
  `fixCjkEmphasis()` が生成する `<strong>` を解釈するために必要なので外せない）

正規表現による除去に戻してはいけない。属性付きの `<script >` や
`<use href="data:...">`、`<animate onbegin=...>` を取りこぼす（[#34](https://github.com/onsoku/WorldDashboard/issues/34)）。

### 5. ジョブが 'running' のままサーバが落ちたら error に倒す

`server/job-store.ts` の `loadAllJobs()` が起動時に変換する。
サブプロセスは既に消えているので、実行中として復元してはいけない
（[#24](https://github.com/onsoku/WorldDashboard/issues/24)）。

## ログの見方

構造化ログは `.claude/logs/server.jsonl`（JSON Lines、gitignore）。
`warn` / `error` は dev コンソールにもミラーされる。

障害調査でまず見るイベント:

| イベント | 意味 |
|---|---|
| `job.start` / `job.exit` | ジョブのライフサイクル。`exitCode` `durationMs` `writtenFiles` を含む |
| `cli.wrote_data` | CLI がデータファイルを書いた |
| `cli.wrote_index` | **不変条件1の違反。** プロンプトが効いていない |
| `cli.result_error` / `cli.stderr` / `cli.spawn_error` | CLI 側の失敗 |
| `index.update` / `index.write` / `index.read_failed` | index.json の更新 |
| `job.restored` / `job.restored_as_interrupted` | 起動時のジョブ復元 |
| `json.auto_repaired` / `json.unrepairable` | 生成 JSON の修復結果 |

`GET /api/research` は2秒間隔のポーリングなのでログから除外している
（除外しないと1日4万行を超える）。POST とジョブ個別 GET は記録される。

## 開発フロー

```bash
npm run dev          # Vite dev サーバ (API はこの中で動く)
npm run test         # Vitest
npm run lint         # ESLint
npx tsc -b           # 型チェック
```

- **feature ブランチを切ってから作業し、main へ fast-forward マージする**
- **コミット／PR 本文では `Closes #N` を使う。** `Resolve #N` や `Fixes issues #N, #M` は
  自動クローズされない。過去に3件の Issue が修正済みのまま放置された
- **Issue を閉じる前に再現手順で検証し、手順と結果をコメントする**
- CI (`.github/workflows/ci.yml`) が push / PR で `tsc -b` → `eslint .` → `vitest run` を実行する
- **`package-lock.json` はコミットする。** gitignore していた頃、CI が
  ローカルと異なる依存を解決し、ローカルで再現しない lint エラーで落ちた（#30）

## テスト

`server/*.test.ts` と `src/**/*.test.ts`。設定は `vitest.config.ts`。

`index-writer` と `job-store` は `process.cwd()` をモジュール読み込み時に評価するため、
テストは一時ディレクトリへ `process.chdir()` してから `vi.resetModules()` + 動的 import で
読み直している。この都合上 `fileParallelism: false` にしてある。

## 既知の設計判断と制約

### ローカルツールとして固める（決定済み）

**このプロジェクトはローカルツールである。製品化しない**
（[#36](https://github.com/onsoku/WorldDashboard/issues/36) で決定）。

API は Vite の `configureServer` プラグインに同居させたままにする。
`npm run build` した `dist/` は既存トピックの**閲覧専用**で、
調査・翻訳・PDF出力・削除は `npm run dev` でしか動かない。これは制約ではなく仕様。

したがって:

- `server/` を Express / Hono の独立プロセスに切り出す提案はしない
- 認証・マルチユーザー・リモートのデータ保存先は考慮しない。単一ユーザーのローカル前提
- 新機能は dev サーバ内で完結する形で設計する。
  [#38](https://github.com/onsoku/WorldDashboard/issues/38)（ジョブ制御）は
  in-process のジョブレジストリで、
  [#41](https://github.com/onsoku/WorldDashboard/issues/41)（SSE）は
  同じ Vite middleware で実装する

### JSON 修復は「開いた構造を閉じる」方式

`server/json-repair.ts` の truncation 復旧は、末尾を切り捨てるのではなく
未閉じの構造を閉じる（[#44](https://github.com/onsoku/WorldDashboard/issues/44)）。
`scanStructure()` が文字列状態とコンテナのスタックを1パスで取り、

1. 全部残して閉じる（開いたままの文字列を閉じ、スタックを逆順に閉じる）
2. 失敗したら直近のカンマ区切りまで巻き戻す（内側から外へ。中身が確定していない
   コンテナは空 `{}` を残さずコンテナごと捨てる）

の順に試す。**ルートに確定した中身が無い場合は復旧を拒否する。**
`{}` でファイルを上書きするのは失敗を報告するより悪い。

復旧できても内容は欠けているので `truncated` / `droppedChars` を返し、
UI は `repair.truncated` で警告する。自動修復（conservative）は従来どおり
切り詰めに触らない。戻すときは `json-repair.test.ts` の truncation 10形状を見ること。

### slug 衝突で既存辞典が消える

新規調査 (`mode: research`) が既存 slug に当たると、警告もバックアップもなく上書きされ、
`versions` の履歴も失われる（[#42](https://github.com/onsoku/WorldDashboard/issues/42)）。
**検証目的でジョブを投入する前に、必ず `index.json` の既存 slug を確認すること。**

### effect 内での setState

`react-hooks/set-state-in-effect` を5箇所で `eslint-disable` している。
いずれも [#45](https://github.com/onsoku/WorldDashboard/issues/45) で解消予定。
新規コードでこのパターンを増やさないこと。

## ディレクトリ

```
.claude/skills/research/SKILL.md  # 調査スキル定義（CLI に丸ごと渡される）
.claude/logs/server.jsonl         # 構造化ログ (gitignore)
.claude/jobs/*.json               # ジョブ永続化 (gitignore)
.claude/tmp/prompt-*.txt          # CLI へ渡すプロンプト (gitignore、掃除は #32)
server/
  research-api.ts                 # Vite プラグイン本体。全 API エンドポイント
  index-writer.ts                 # index.json の唯一の書き手 (mutex)
  job-store.ts                    # ジョブの永続化と復元
  job-logger.ts                   # 構造化ログ
  json-repair.ts                  # 生成 JSON の検証・修復
  slug.ts                         # slug 検証とパス解決
src/
  components/  context/  hooks/  i18n/  lib/  print/  types/
public/data/                      # 生成された辞典データ (gitignore)
SESSIONS/                         # 作業ログ (gitignore、ローカル専用)
```

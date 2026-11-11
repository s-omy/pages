# LLM技術週報

公開先: https://pages.oro-9.org/schedule_report/openai-gpt/weekly_llm_study/

- index.html: 最新号全文
- archive/YYYY-MM-DD.html: 各号固定ページ
- archive/index.html: 週別一覧
- content/YYYY-MM-DD.md: 添付元レポート（UTF-8）
- assets/style.css: 共通CSS
- latest.json: schemaVersion=1、date=JST発行日、tagline=1〜120文字

過去3号はユーザー添付Markdownから移植。本文と当時の記述を保持。出典リンクや事実は独立再検証していません。URLのない出典アイコンは「記事URL未収録」と明示し、検索画像はHTMLでは省略、元Markdownは保持します。

週次更新は対象ディレクトリ内のみを更新。最新号、当週固定ページ、元Markdown、一覧、latest.jsonを同一コミットで整合させます。既存アーカイブは保持し、新しい発行日を巻き戻しません。最新mainのtreeをベースに対象ファイルだけを変更し、expected_shaとforce=falseで更新。競合時は最新mainから最大3回再適用。

元Markdownリンクはclass="source"、download必須。最新号からcontent/YYYY-MM-DD.md、archiveから../content/YYYY-MM-DD.md。public/は公開URLには含めません。既存Cloudflare設定・他カテゴリ・共通入口を変更しません。

## 表示スタイル

2026-11-12: 本文テキスト・出典・リンク・日付を変更せず、共通CSSと表示用マークアップを更新。

- 見出し: chapter / chapter-number、補助見出し: subheading、数値: metric
- 冒頭要点: brief-title / brief-meta / brief-body / brief-source
- 分析: topic-title、analysis-grid 内の analysis-field / analysis-label、analysis-source
- 学習・検証: action-title / action-time / action-body
- 文献: reading-title / reading-meta / reading-body
- 概念: concept-title / concept-body

今後の号も既存CSSと上記の表示構造を再利用。表示目的のclass/span追加は可能ですが、本文の要約・省略・置換はしません。モバイルでは分析を1列、比較表は表内だけ横スクロール。配信時のHTML本文・元Markdownへのdownloadリンクを保持します。

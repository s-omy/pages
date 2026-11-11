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

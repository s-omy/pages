# VTuber / VSinger Daily Brief

2026-10-23号の会話レポートを移植した、ビルド不要の静的HTML/CSSサイト。
現在のChatGPT Scheduledは変更せず、自動取得・更新も接続していません。

## ファイル

- `index.html`: 最新号の全文
- `archive/index.html`: 日付別一覧
- `archive/2026-10-23.html`: 日付固定の全文
- `assets/style.css`: 共通スタイル（モバイル・印刷対応）
- `content/2026-10-23.md`: 取得した元レポート
- `.nojekyll`: 静的ファイルとして公開するためのマーカー

HTMLはJavaScript、外部フォント、外部ライブラリに依存せず閲覧できます。
相対リンクのため、リポジトリ直下とサブフォルダのどちらでも配置できます。

## 出典の扱い

本文は参照ChatGPT会話「VTuber デイリーレポート」の2026-10-23号です。
元レポートの記述や出典URLを独立には再検証していません。
ページ上部で全体が未検証であることを明示し、復元できない引用トークンを
「引用先未復元」に置換しています。人物エンティティは表示名に変換しました。
元レポートの「確認した」等の表現は当時の記述です。

## GitHub Pagesへの配置

配置先: `s-omy/pages` の `main` ブランチ、`schedule_report/openai-gpt/vtuber/`（ユーザー確認済み）。
`s-omy/pages`は既存サイトを含むため、ルートの`index.html`や`CNAME`を置換しないでください。
このフォルダ一式を確認済みの配置先に追加します。
既存の`schedule_report`配下に配置する場合も、既存ファイルの有無を確認してください。

新規専用リポジトリに配置する場合:

1. ファイル一式を公開ブランチのルートへコミット。
2. GitHubのSettings → Pagesを開く。
3. Build and deployment → SourceをDeploy from a branchにする。
4. 公開ブランチと`/(root)`を選びSave。
5. 公開URLが表示されたら、最新号・日付別ページ・CSSの表示を確認。

既存Pagesサイトのサブフォルダへ追加する場合は、現在の公開元と配信方式を確認し、既存設定を保ったまま追加します。
既存サイトにはCloudflare関連ファイルも存在するため、GitHub Pagesで公開中とは未確認です。

公式手順: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 日々の更新

新しい日付固定HTMLと元レポートを追加し、最新号`index.html`とアーカイブ一覧を更新します。
日付固定HTMLは後日の更新で上書きしないでください。
元データの日時はJSTとして記載し、検証済み表示に変える場合は項目ごとに出典を確認してください。


# Codex + cc-sdd による、ビジネスフレームワーク準拠の仕様駆動開発ベストプラクティス

確認日: 2026-07-08
対象: Codex / Codex CLI / Codex app / Codex Skills / AGENTS.md / MCP / Subagents / cc-sdd v3系 / Kiro型 spec-driven development
前提: 本レポートでは、cc-sdd は gotalab/cc-sdd の一次ドキュメントに基づく OSS ワークフローとして扱う。OpenAI 公式機能ではない。

---

## 1. エグゼクティブサマリー

Codex + cc-sdd を、業務共通機能を持つビジネスフレームワーク上の開発に使う場合、最も重要なのは「AIに実装を任せること」ではなく、「AIが逸脱できない契約・境界・検証ループを先に作ること」である。

Codex は、リポジトリを読んで編集し、コマンド実行・テスト・レビュー・MCP連携・Skills・Subagents・worktreeを使える実行エージェントである。Codex CLI はローカル端末で動く coding agent で、選択ディレクトリ内のコードを読み、変更し、コマンドを実行できる。Codex app は複数スレッド、worktree、Git機能、Skills、Automationsを扱う開発ハブとして位置づけられている。

cc-sdd は、要件・設計・タスク・実装を spec harness としてつなぐワークフローである。v3系では `/kiro-discovery`、`/kiro-spec-*`、`/kiro-impl` を中心に、Agent Skills、fresh implementer、independent reviewer、auto-debug、Implementation Notes、boundary-first spec discipline を組み合わせる。cc-sdd 自身は spec を「エージェントへの命令書」ではなく「システム各部の契約」として扱い、コードを最終的な source of truth と位置づけている。

ビジネスフレームワーク準拠開発では、通常のWebアプリ開発よりも、認証・認可、監査ログ、業務例外、トランザクション、DTO、権限、メッセージ体系、バッチ規約、禁止API、運用制約などの横断ルールが多い。そのため、いきなり「この機能を実装して」と指示すると、AIは素のSpring Boot、素のJPA、素のREST設計、素の例外処理を生成しやすい。これはコードが動くほど危険である。

結論は次の通り。

| 結論           | 実務上の意味                                               |
| ------------ | ---------------------------------------------------- |
| 最初に整備すべきもの   | `AGENTS.md` ではなく、フレームワークルールのID化・golden sample・レビュー観点 |
| 最も費用対効果が高い施策 | 代表実装を golden sample として指定し、設計前に「適用ルール一覧」を出させる        |
| cc-sdd が効く領域 | 新規CRUD、既存CRUD拡張、テスト追加、バグ修正、業務バリデーション、差分の小さい横展開       |
| 人間が握るべき判断    | 業務判断、権限設計、監査要件、トランザクション境界、フレームワーク拡張、例外許容             |
| トークン最適化の本質   | 規約を短くすることではなく、毎回読むべきものと必要時に参照するものを分けること              |
| 避けるべき初期導入    | 大規模リファクタ、フレームワーク自体の改修、複数境界をまたぐ自律実装                   |

---

## 2. 前提と用語整理

### 2.1 2026年時点で確認した主要事実

| 項目                  | 2026年時点の確認内容                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Codex CLI           | OpenAIのローカル coding agent。端末から実行し、選択ディレクトリ内でコード読解・編集・コマンド実行を行う。                                                                                               |
| Codex app           | 複数プロジェクト・複数スレッド、Local / Worktree / Cloud、worktree、Git diff、commit、PR作成、内蔵端末を扱うデスクトップ体験。                                                                      |
| AGENTS.md           | Codex は作業前に `AGENTS.md` を読む。グローバル、プロジェクト、サブディレクトリ単位で階層化でき、近い階層の指示が後勝ちになる。標準の既定上限は `project_doc_max_bytes` 32 KiB。                                            |
| Skills              | Codex Skills は `SKILL.md`、scripts、references、assets 等を束ねる再利用ワークフロー。Codex は skill の name / description / path を先に読み、必要時に全文を読む progressive disclosure を採用している。 |
| MCP                 | Codex は MCP サーバーを `config.toml` で構成でき、STDIO / Streamable HTTP / OAuth 等をサポートする。MCP は外部ツール・外部コンテキストが必要なときに有効だが、OpenAIのベストプラクティスでは「最初から全ツールをつなぐな」とされている。       |
| Sandbox / Approval  | Codex はデフォルトでネットワークアクセスを無効化し、ローカルではOSのsandboxとapproval policyで操作境界を制御する。sandbox は技術的境界、approval は境界越えの承認制御である。                                               |
| Subagents           | Codex は明示指示により subagent を起動できる。大きな探索・テスト・調査を別スレッドに逃がせるが、subagentごとにモデル・ツール作業が発生するためトークンコストは増える。                                                              |
| Codex review        | GitHub PRに対して Codex review を利用でき、`AGENTS.md` のレビュー指針を参照できる。GitHub上では高優先度リスクに絞ったレビューを行う設計が説明されている。                                                            |
| cc-sdd v3           | Agent Skillsを中心に、discovery、requirements、design、tasks、autonomous implementation、independent review を統合する。Codex Skills は stable とされる。                          |
| cc-sdd `/kiro-impl` | 承認済み `tasks.md` に対し、タスク単位で fresh implementer、reviewer、debugger を使い、TDD、feature flag、independent review、auto-debug、Implementation Notes を回す。                  |

### 2.2 spec-first / spec-anchored / spec-as-source

| 用語             | 意味                                                | 業務フレームワーク開発での推奨度                   |
| -------------- | ------------------------------------------------- | ---------------------------------- |
| spec-first     | 実装前に仕様を書く。仕様は主に開始条件。                              | 中。仕様が古くなると危険。                      |
| spec-anchored  | 仕様を要件・設計・タスク・レビューのアンカーにする。ただし最終出荷物はコード。           | 高。cc-sdd の思想に近い。                   |
| spec-as-source | 仕様を唯一のソースとしてコード生成する。OpenAPI、protobuf、DDL、状態遷移表など。 | 部分的に高。全業務判断をspec-as-sourceにするのは過剰。 |

ビジネスフレームワーク上では、全体を spec-as-source に寄せるより、「API契約・エラーコード・権限定義・メッセージ定義・DTO schema」は spec-as-source 寄り、「業務フロー・責務境界・トランザクション・監査」は spec-anchored にするのが現実的である。

---

## 3. Codex + cc-sdd + ビジネスフレームワークの全体像

### 3.1 役割分担

| 役割        | 担うもの                                                        | 担わせないもの                   |
| --------- | ----------------------------------------------------------- | ------------------------- |
| cc-sdd    | 要件整理、境界定義、設計、File Structure Plan、タスク分解、TDD・review・debugの制御面 | 業務判断の最終決定、組織ルールの解釈変更      |
| Codex     | コード探索、実装、テスト生成、テスト実行、diff作成、局所レビュー、修正ループ                    | 未承認の大規模設計変更、権限・監査・運用判断の独断 |
| AGENTS.md | 毎回守る短い作業契約、参照先インデックス、検証コマンド、禁止事項の入口                         | 長大な業務規約本文、全例外、全設計思想       |
| Skills    | 繰り返し使う作業手順、レビュー手順、ルール適用手順、調査手順                              | 変化の激しい個別要件                |
| MCP       | 外部ドキュメント、チケット、API仕様、DBメタデータ、監視情報などの取得                       | ただの長文規約置き場、無制限の本番操作       |
| 人間        | 承認ゲート、業務判断、権限、監査、設計例外、リリース判断                                | 機械的な横展開、定型テスト生成、単純差分レビュー  |

### 3.2 通常のWebアプリ開発との違い

通常のWebアプリでは「Controller → Service → Repository」「DTO → Entity」「例外 → HTTP status」程度の一般論でかなり進む。しかし業務フレームワーク上では、同じ構造名でも実装意味が違う。

例:

| 一般的実装                          | ビジネスフレームワーク上の実装                   |
| ------------------------------ | --------------------------------- |
| `@PreAuthorize` を直接書く          | フレームワークの権限チェックAPI、権限ID、業務ロール解決を経由 |
| `log.info()` で操作ログ             | 操作ログ共通部品に業務操作ID、主体、対象、結果、相関IDを渡す  |
| `throw new RuntimeException()` | 業務例外・システム例外・エラーコード・メッセージ体系に従う     |
| `@Transactional` をServiceに付与   | ユースケース境界、外部連携、イベント発行、監査確定順序を考慮    |
| Repositoryで自由にJOIN             | データアクセス規約、論理削除、テナント条件、権限制約を通す     |
| Controllerで入力チェック              | 入力チェック、業務バリデーション、相関チェックの層を分ける     |

AIにこの差分を教えないと、「動くがフレームワークを迂回したコード」が生成される。これは将来の監査、障害調査、権限漏れ、保守性低下に直結する。

### 3.3 仕様駆動開発が効く理由

cc-sdd の価値は、仕様書を綺麗に作ることではない。`requirements.md`、`design.md`、`tasks.md`、Implementation Notes を使って、AIの作業を「境界内の小さな変更」に閉じ込める点にある。cc-sdd は `/kiro-impl` が `tasks.md` を中心に一つずつタスクを実行し、TDD、task-local review、bounded remediation を行うと説明している。

特に業務フレームワークでは、次が効く。

* 実装前に「適用される業務共通ルール」を列挙できる。
* `design.md` に責務境界とファイル構造を固定できる。
* `tasks.md` に `_Boundary:_` と `_Depends:_` を明示できる。
* review を「スタイル」ではなく「仕様準拠・境界準拠・フレームワーク準拠」に寄せられる。
* 実装後に「どのルールIDに準拠したか」を自己監査できる。

### 3.4 過剰になりやすいケース

cc-sdd 公式も、すべての変更に正式specをかける思想ではない。単独セッションで終わる作業、捨てるプロトタイプ、契約を明示するコストが勝たない作業では不要になり得る。`/kiro-discovery` が「spec不要で直接実装」を返すことも妥当な分岐とされている。

過剰になりやすい例:

| 作業                    | 推奨                     |
| --------------------- | ---------------------- |
| typo修正                | 直接実装                   |
| テスト名変更                | 直接実装                   |
| 既存パターンに沿う1項目追加        | 軽量specまたは実装前チェックのみ     |
| 監査・権限・トランザクションに触る変更   | cc-sddフルフロー            |
| 複数画面・複数API・バッチにまたがる変更 | discovery → spec batch |

---

## 4. 情報設計とドキュメント設計

### 4.1 基本方針

情報設計の原則は「AGENTS.mdを太らせない」「規約をID付き契約にする」「詳細は参照ファイルへ逃がす」「実装前に適用ルールを列挙させる」である。

OpenAIのベストプラクティスでも、短く正確な `AGENTS.md` が有用で、肥大化したら planning、code review、architecture などのMarkdownへ分けること、同じ失敗が2回起きたらレトロスペクティブして `AGENTS.md` を更新することが推奨されている。

### 4.2 どこに何を書くか

| 置き場所                 | 書くべき情報                                               | 書かない情報            |
| -------------------- | ---------------------------------------------------- | ----------------- |
| `AGENTS.md`          | 作業契約、検証コマンド、参照ファイル一覧、禁止事項の入口、レビューゲート                 | 規約全文、長大な設計思想、例外一覧 |
| `.codex/config.toml` | sandbox、approval、model、MCP、profile                   | 業務要件、設計判断         |
| `.kiro/steering/`    | プロジェクト目的、技術スタック、構造、ビジネスフレームワーク概要                     | 個別機能の詳細           |
| `docs/framework/`    | フレームワーク概念、拡張ポイント、責務分担、共通部品一覧                         | 個別案件の受け入れ条件       |
| `docs/rules/`        | ID付きルール、禁止事項、代替実装、適用条件                               | 物語的な長文説明だけの規約     |
| `docs/examples/`     | golden sample、典型CRUD、権限付きAPI、監査ログ付き更新処理              | 古い実装、例外的実装        |
| `docs/review/`       | レビュー観点、重大度、チェックリスト                                   | チーム固有の雑多なメモ       |
| `specs/<feature>/`   | brief、requirements、design、tasks、Implementation Notes | 全社共通規約本文          |

### 4.3 ルールID化の例

```markdown
# docs/rules/transaction.md

## BF-TX-002: 更新系ユースケースのトランザクション境界

適用条件:
- DB更新を伴う同期API
- 監査ログまたは操作ログを記録する業務操作

ルール:
- トランザクション境界は UseCase 層に置く。
- Repository 層にトランザクション開始を書いてはならない。
- 外部API呼び出しを同一DBトランザクション内に含めない。

禁止:
- Controller に `@Transactional` を付与する。
- Repository から別ユースケースを呼び出す。

代替実装:
- `BusinessTransactionExecutor` を使う。
- 外部連携が必要な場合は Outbox または post-commit event を使う。

確認方法:
- `@Transactional` の付与箇所を grep。
- 更新APIのテストで rollback ケースを確認。

関連:
- BF-LOG-003
- BF-EXCEPTION-004
```

ポイントは、`Do not use X` だけにしないことだ。AIは「では何を使うべきか」がないと、禁止事項を避けた別の不適切実装を作る。必ず「代替実装」「適用条件」「確認方法」をセットにする。

### 4.4 悪いドキュメント例と良いドキュメント例

悪い例:

```markdown
認可は共通部品を使うこと。
例外は適切に処理すること。
ログは必要に応じて出すこと。
トランザクションに注意すること。
```

良い例:

```markdown
この変更で適用される可能性があるルール:
- BF-AUTH-001: 業務APIは必ず BusinessPermissionEvaluator を通す
- BF-LOG-003: 更新系操作は operationLog に OP_ID を記録する
- BF-EXCEPTION-004: 入力不備は BusinessValidationException と BF-VAL 系コード
- BF-TX-002: 更新系UseCaseのトランザクション境界は UseCase 層

実装前に行うこと:
1. 変更対象ユースケースに適用されるルールIDを列挙する。
2. 各ルールについて、適用 / 非適用 / 判断保留を表にする。
3. 判断保留がある場合は実装しない。
```

### 4.5 フレームワーク用語集

最初に作るべきは「技術用語集」ではなく「この組織での意味の用語集」である。

| 用語                 | 一般的意味            | このフレームワークでの意味                | 代表クラス / ファイル              |
| ------------------ | ---------------- | ---------------------------- | ------------------------- |
| UseCase            | Serviceと同義に使われがち | トランザクション境界、権限確認、監査単位         | `OrderUpdateUseCase`      |
| Service            | 業務ロジック           | 再利用可能なドメインサービス。トランザクションを持たない | `PriceCalculationService` |
| Operation Log      | 任意ログ             | 監査対象の業務操作ログ。OP_ID必須          | `OperationLogger`         |
| Business Exception | 例外全般             | 利用者に返せる業務エラー。エラーコード必須        | `BusinessException`       |
| System Exception   | 予期せぬ障害           | 利用者に詳細を返さない。監視通知対象           | `SystemException`         |

---

## 5. cc-sdd フェーズ別ベストプラクティス

cc-sdd の `/kiro-discovery` は新規作業を route し、scope を整え、`brief.md` と必要なら `roadmap.md` を書き、次コマンドを示して止まる。`/kiro-impl` は承認済み `tasks.md` を前提に、自律モードでは task ごとに fresh implementer + reviewer + debugger を使う。

### 5.1 フェーズ別一覧

| フェーズ                      | 目的            | 投入すべき情報                                 | 生成物                              | 人間の確認観点                            | 失敗しやすい点      | トークン最適化                          |
| ------------------------- | ------------- | --------------------------------------- | -------------------------------- | ---------------------------------- | ------------ | -------------------------------- |
| `/kiro-discovery`         | spec要否と分割判断   | 業務目的、非ゴール、影響範囲、既存機能名                    | `brief.md`, `roadmap.md`         | 1 specでよいか、spec batchか、直接実装か       | 何でも巨大specにする | 詳細規約は貼らず、ルール索引だけ渡す               |
| `/kiro-spec-init`         | specワークスペース作成 | feature名、関連docs、golden sample           | spec骨子                           | scope名、成果物名、境界                     | 名前が曖昧で後続がぶれる | 命名規則を `docs/rules/naming.md` に分離 |
| `/kiro-spec-requirements` | EARS風要件・受入条件  | 業務フロー、権限、入力、異常系、監査                      | `requirements.md`                | 業務判断、権限、監査、非機能                     | happy path中心 | 要件テンプレに「異常系・監査・権限」を固定            |
| `/kiro-spec-design`       | 構造・責務・境界      | 代表実装、ルールID、API規約、DB規約                   | `design.md`, File Structure Plan | 層責務、トランザクション、禁止API                 | 素の設計に戻る      | 適用ルール一覧を先に出させる                   |
| `/kiro-spec-tasks`        | 実装単位へ分解       | design、依存関係、テスト方針                       | `tasks.md`                       | `_Boundary:_`, `_Depends:_`, テスト含有 | 1タスクが大きすぎる   | 1タスク=1境界=1検証に制限                  |
| `/kiro-impl`              | タスク単位実装       | 承認済みtasks、Implementation Notes、検証コマンド   | diff、テスト、Notes                   | 差分最小性、ルール準拠                        | ついで修正、横展開しすぎ | worktree + 1スレッド1タスク             |
| independent review        | 第三者視点検証       | diff、requirements、design、rules          | findings                         | 仕様準拠、境界、機械的検証                      | style指摘に偏る   | レビュー観点を3分類                       |
| auto-debug                | 詰まり時の根因分析     | 失敗ログ、reject理由、対象タスク                     | root cause, fix plan             | 根因妥当性、範囲外修正なし                      | 場当たり的修正      | ログ全文でなく失敗要約＋再現手順                 |
| 再実行・中断復帰                  | 長時間作業再開       | tasks状態、Implementation Notes、git status | 継続実装                             | 完了済み再実装なし                          | 前回文脈の喪失      | Notesに決定事項だけ残す                   |
| Implementation Notes      | タスク間知見継承      | 実装で得た制約、罠、例外                            | `tasks.md`追記                     | 汎用知見か、一時ログか                        | ログ置き場化       | 1 note = 1知見 + 根拠 + 次タスク影響       |

### 5.2 ビジネスフレームワーク準拠のフェーズ運用

#### `/kiro-discovery`

ここでは「作るもの」より「どの境界に触るか」を優先する。

必ず出させるもの:

* 影響する業務領域
* 影響するフレームワークルール群
* 既存実装の候補
* spec不要 / 単一spec / spec batch の理由
* 非ゴール
* 人間判断が必要な点

判断例:

| 入力依頼              | discoveryでの分岐 |
| ----------------- | ------------- |
| 既存画面に項目を1つ追加      | 直接実装または軽量spec |
| 更新APIに承認フローを追加    | 単一spec        |
| 権限体系、監査ログ、バッチも変更  | spec batch    |
| 既存フレームワークの例外処理を変更 | 人間アーキテクト承認必須  |

#### `/kiro-spec-requirements`

業務フレームワークで不足しやすい要件は、次の7つである。

| 要件種別     | 要件に書く内容                  |
| -------- | ------------------------ |
| 権限       | どのロール・業務権限・状態で許可/拒否するか   |
| 監査       | 誰が、何に、何を、いつ、どう変更したか      |
| 入力       | 単項目チェック、相関チェック、業務状態チェック  |
| 例外       | 業務例外、システム例外、エラーコード、メッセージ |
| トランザクション | 何を同一単位で確定するか、外部連携は含むか    |
| 非機能      | 性能、同時実行、冪等性、運用監視         |
| テスト      | 正常、異常、境界、権限、監査、rollback  |

#### `/kiro-spec-design`

`design.md` は「クラス図」より「責務境界」が重要である。cc-sdd v3 は boundary-first を重視し、`design.md` の File Structure Plan が task boundary の根拠になる。

`design.md` に必ず入れる項目:

```markdown
## Applicable Framework Rules
| Rule ID | 適用理由 | 実装箇所 | 確認方法 |
|---|---|---|---|

## File Structure Plan
| File | Change Type | Responsibility | Related Rule IDs | Tests |
|---|---|---|---|---|

## Transaction Boundary
- 開始層:
- commit対象:
- rollback対象:
- 外部連携:
- post-commit処理:

## Logging / Audit
- operation id:
- audit event:
- fields:
- masking:

## Error Handling
- business errors:
- system errors:
- message codes:
```

#### `/kiro-spec-tasks`

`tasks.md` は「やることリスト」ではなく「AIが勝手に越えてはいけない境界リスト」である。

良いタスク例:

```markdown
- [ ] Task 3: 注文更新UseCaseにステータス遷移チェックを追加する
  _Boundary:_ `OrderUpdateUseCase`, `OrderStatusPolicy`, related unit tests only.
  _Depends:_ Task 1, Task 2
  _Rules:_ BF-TX-002, BF-EXCEPTION-004, BF-VAL-006
  _Do not touch:_ API schema, Repository query, migration files
  _Tests:_ invalid transition, rollback, message code
```

悪いタスク例:

```markdown
- [ ] 注文更新機能を実装する
```

#### `/kiro-impl`

自律実装前の条件:

* `requirements.md` 承認済み
* `design.md` 承認済み
* `tasks.md` 承認済み
* 各タスクに `_Boundary:_`、`_Depends:_`、`_Rules:_`、`_Tests:_` がある
* golden sample が指定されている
* 触ってよいファイルと触ってはいけないファイルが明記されている
* 検証コマンドが明記されている

Codex 側では、sandbox/approval/worktree を使い、境界外のファイル変更やネットワークアクセスを抑制する。Codex の sandbox は spawned commands にも適用されるため、test runner や package manager の実行も境界内で扱える。

---

## 6. 「これをすると効く」TIPS集

| No | TIPS                                  | 効く理由                 | 適用ユースケース      | 逆効果になるケース   | トークンコスト影響 | サンプル指示                                          |
| -: | ------------------------------------- | -------------------- | ------------- | ----------- | --------- | ----------------------------------------------- |
|  1 | 最初にフレームワーク用語集を作る                      | AIの一般用語解釈を防ぐ         | 既存業務基盤全般      | 小規模PoC      | 初期増、後続減   | `docs/framework/glossary.md を読み、この機能で使う用語を列挙して` |
|  2 | ルールをID化する                             | reviewとtraceが可能      | 権限、監査、例外、TX   | ルールが未整理     | 中期で大幅減    | `適用ルールIDを表にしてから設計して`                            |
|  3 | 禁止事項は代替実装とセットで書く                      | AIが別の逸脱をしない          | 禁止API、独自SQL禁止 | 代替が未確定      | 減         | `禁止事項ごとに代替APIを示して`                              |
|  4 | `AGENTS.md`を短くし詳細は参照化                 | 常時コンテキストを圧縮          | 大規模repo       | 参照先が古い      | 大幅減       | `AGENTS.md には rules index のみ置く`                 |
|  5 | 1スレッド1タスク                             | context rotを抑える      | 実装、修正、レビュー    | 密接な設計議論     | 減         | `このスレッドでは Task 4 だけ扱う`                          |
|  6 | 大きな業務要件は spec batch で分割               | 境界・依存を保てる            | 複数画面/API      | 小変更         | 増だが手戻り減   | `roadmap.md に分けて /kiro-spec-batch 前提で整理`        |
|  7 | 実装前に適用ルール一覧を出させる                      | 素の実装を防ぐ              | 業務API全般       | ルールが曖昧      | 少増、大効果    | `実装前に Applicable Framework Rules を作成`           |
|  8 | `design.md`にFile Structure Planを必ず書く  | tasksの境界根拠になる        | 新規機能          | 1ファイル修正     | 少増        | `File Structure Planなしで設計完了にしない`                |
|  9 | `tasks.md`に`_Boundary:_`と`_Depends:_` | scope creepを防ぐ       | 自律実装          | 調査だけ        | 少増        | `各taskに Boundary/Depends/Rules/Tests を付けて`      |
| 10 | golden sampleを指定する                    | 既存流儀の横展開が安定          | CRUD、バッチ      | sampleが例外実装 | 大幅減       | `この3ファイルをgolden sampleとして差分最小で`                 |
| 11 | 変更対象ファイルと触らないファイルを宣言                  | overeager actionを抑える | バグ修正、項目追加     | 影響調査前       | 減         | `実装前に touch / no-touch list を出して`               |
| 12 | テスト生成を実装タスクに含める                       | 完了条件が明確              | 全実装           | 探索PoC       | 増だが品質増    | `Taskには必ず tests を含める`                           |
| 13 | reviewを3分割する                          | スタイル偏重を防ぐ            | PR review     | typo修正      | 少増        | `仕様準拠/フレームワーク準拠/差分最小性で評価`                       |
| 14 | 同じ失敗2回でrules反映                        | 学習を運用に残せる            | 導入初期          | 一過性障害       | 後続減       | `今回の再発防止としてAGENTS.md/rules更新案を出して`              |
| 15 | 要約インデックス + 参照ファイル方式                   | 長文貼り付けを防ぐ            | 大規模規約         | 参照不能環境      | 大幅減       | `rules/index.md から必要な詳細だけ読んで`                   |
| 16 | 拡張ポイントを明文化                            | フレームワーク改造を防ぐ         | 共通処理追加        | 設計未成熟       | 中         | `利用可能なextension point以外は使わない`                   |
| 17 | 「なぜこの層か」を説明させる                        | 責務境界逸脱を検出            | design review | 単純DTO追加     | 少増        | `各クラスの配置理由を1行で説明`                               |
| 18 | 仕様・設計・タスク矛盾検出を先に走らせる                  | 実装前手戻りを減らす           | `/kiro-impl`前 | 超小変更        | 中増、手戻り減   | `requirements/design/tasks の矛盾だけをレビュー`          |
| 19 | 実装後にルール準拠を自己監査                        | 監査・レビューが楽            | 業務機能          | 試作          | 中         | `生成コードが準拠するRule IDを証跡付きで表にして`                   |
| 20 | AI範囲と人間ゲートを明確化                        | 無承認の判断を防ぐ            | 全体運用          | 個人PoC       | 減         | `判断保留は実装せず HUMAN_DECISION_REQUIRED と出して`        |

---

## 7. ユースケース別評価

| ユースケース       | 有効度 | 得意な理由           | 注意点             | 必要ドキュメント           | 推奨cc-sddフロー            | Codexの使い方        | トークン傾向 | 人間レビュー |
| ------------ | --: | --------------- | --------------- | ------------------ | ---------------------- | ---------------- | ------ | ------ |
| 新規CRUD機能     |   高 | パターン化しやすい       | 権限・監査抜け         | CRUD golden sample | full flow              | worktree実装       | 中      | 中      |
| 既存CRUDへの項目追加 |   高 | 差分小             | migration/API互換 | 既存実装               | discovery→軽量spec       | diff最小           | 低      | 中      |
| 新規業務ユースケース   |  中高 | 要件整理が効く         | 業務判断は人間         | 用語集、業務ルール          | full flow              | plan→impl        | 中高     | 高      |
| 複数画面/API追加   |   中 | 分割できれば強い        | 境界衝突            | roadmap            | discovery→spec batch   | subagentsは調査中心   | 高      | 高      |
| バッチ処理追加      |   高 | 定型化しやすい         | 冪等性・再実行         | batch rules        | full flow              | TDD + smoke      | 中      | 高      |
| 外部システム連携     |   中 | 契約整理に強い         | 障害・再送・認証        | IF仕様、MCP可          | full flow              | mock生成           | 高      | 高      |
| 権限・認可ルール追加   |   中 | matrix化できる      | セキュリティ判断        | auth rules         | requirements重視         | 実装は限定            | 中      | 最高     |
| 監査ログ・操作ログ    |   高 | 横断パターン          | PIIマスク          | log rules          | design重視               | golden sample横展開 | 中      | 高      |
| 業務バリデーション    |   高 | 条件表→テスト化        | 例外体系            | validation rules   | requirements→tasks     | テスト大量生成          | 中      | 高      |
| リファクタリング     |   中 | 差分レビューに強い       | scope拡大         | no-touch list      | discovery必須            | 小分けworktree      | 中高     | 高      |
| テスト追加        |  最高 | 既存仕様から生成        | テスト意図           | test rules         | 直接またはtasks             | read-heavy       | 低中     | 中      |
| バグ修正         |   高 | 再現→修正→検証        | 場当たり修正          | bug report         | 軽量spec                 | root-cause first | 中      | 高      |
| エラー処理統一      |  中高 | 機械的横展開          | 一括変更リスク         | exception rules    | spec batch             | subagent調査       | 高      | 高      |
| 技術的負債返済      |   中 | 分解が効く           | 目的が曖昧           | debt list          | roadmap化               | review中心         | 高      | 高      |
| フレームワーク自体の拡張 |  低中 | 設計案比較は可         | 思想変更は危険         | ADR、設計原則           | 人間主導                   | 調査・試作まで          | 高      | 最高     |
| レガシー移行       |   中 | パターン移行に強い       | 例外だらけ           | migration rules    | spec batch             | golden sample単位  | 高      | 高      |
| 仕様書から実装      |   高 | spec harnessに合う | 仕様の古さ           | requirements原本     | discovery→full         | 差分最小             | 中高     | 高      |
| 既存実装から仕様逆生成  |   高 | 読解・整理が得意        | 実装バグを仕様化しない     | code + docs        | discovery→requirements | read-only探索      | 中      | 高      |

---

## 8. 得意分野・苦手分野

### 8.1 得意分野

| 領域             | 理由                  | 任せ方                 |
| -------------- | ------------------- | ------------------- |
| パターン化された実装     | golden sampleを模倣できる | 代表実装を指定して横展開        |
| 既存実装の横展開       | 命名・層構成・テストを踏襲しやすい   | no-touch list付きで実装  |
| テスト生成          | 条件表からケース化しやすい       | 正常/異常/境界/権限/監査を指定   |
| 差分の小さい修正       | 変更境界を限定しやすい         | `git diff`レビューを必須化  |
| タスク分解          | cc-sddの得意領域         | `_Boundary:_`を必須にする |
| 仕様と実装のトレース     | ルールID・要件IDで紐づけ可能    | 実装後にtrace table生成   |
| レビュー観点の機械的チェック | チェックリスト化できる         | reviewを3分類する        |

### 8.2 苦手・注意領域

| 領域              | リスク         | 対策                    |
| --------------- | ----------- | --------------------- |
| 暗黙知が多い業務判断      | もっともらしい誤判断  | 人間承認ゲート               |
| フレームワーク設計思想の変更  | 局所最適な破壊     | ADR必須                 |
| 複数境界をまたぐ大規模変更   | scope creep | spec batch + no-touch |
| 性能・運用・監査・セキュリティ | 非機能の見落とし    | 専用review              |
| 既存コードに一貫性がない    | 悪いsampleを模倣 | golden sample選定       |
| ドキュメントが古い       | 誤った規約準拠     | code優先、docs更新         |
| ルールが例外だらけ       | AIが重要度判断不能  | 例外ルールもID化             |

研究面でも、長いコンテキストは万能ではない。Chromaの技術レポートは、入力長が伸びるとモデル性能が非一様に不安定化し、関連情報の有無だけでなく提示方法が重要になると報告している。これは、長大な規約を丸ごと貼る運用より、短い索引・必要時参照・境界分割が有効であることを支持する。

---

## 9. トークンコスト最適化

### 9.1 何がトークンを浪費するか

| 浪費要因         | 問題                    |
| ------------ | --------------------- |
| 長大な規約を毎回貼る   | 重要ルールが埋もれ、コストも増える     |
| 1スレッド1プロジェクト | 過去ログでcontext rotが起きる  |
| 実装ログを会話に全部残す | 失敗ログが判断を汚染する          |
| ルールが自然文だけ    | AIが参照・引用・自己監査できない     |
| sampleが多すぎる  | どれを模倣すべきか曖昧           |
| MCPをつなぎすぎる   | tool選択と説明でコスト増、誤操作リスク |
| review観点が曖昧  | スタイル指摘に消費する           |

Codex の公式ベストプラクティスでも、MCPは外部コンテキストがリポジトリ外にある、データが頻繁に変わる、ツール利用が必要、複数ユーザー・プロジェクトで再利用したい場合に使うとされ、最初から全ツールを接続しないことが推奨されている。

### 9.2 施策表

| 施策                   | トークン削減効果 | 品質への影響 | 導入難易度 | 推奨度 | コメント                 |
| -------------------- | -------: | ------ | ----- | --- | -------------------- |
| ルールID化               |        高 | 高      | 中     | 最高  | review・trace・自己監査が容易 |
| AGENTS.md短縮          |        高 | 高      | 低     | 最高  | 索引化が前提               |
| golden sample指定      |        高 | 高      | 低     | 最高  | 説明より実例が効く            |
| File Structure Plan  |        中 | 高      | 中     | 高   | 初期コストはある             |
| `_Boundary:_`明記      |        中 | 高      | 低     | 最高  | scope creep防止        |
| 1スレッド1タスク            |        高 | 高      | 低     | 最高  | context rot防止        |
| spec batch           |        中 | 高      | 中     | 高   | 大規模案件向け              |
| Implementation Notes |        中 | 高      | 低     | 高   | ログではなく知見だけ残す         |
| review専用コンテキスト       |        中 | 高      | 中     | 高   | 実装ログから切り離す           |
| MCP導入                |    場合による | 中〜高    | 中高    | 中   | 外部情報が変化する場合のみ        |
| Skills化              |        高 | 高      | 中     | 高   | 繰り返し作業に有効            |
| Subagents            |      低〜負 | 中〜高    | 中     | 中   | 時間短縮はあるがトークン増        |
| 長文規約貼り付け禁止           |        高 | 高      | 低     | 最高  | 参照ファイルが必要            |
| 自動review             |        中 | 中〜高    | 中     | 高   | 人間レビュー代替ではない         |
| トークン節約優先で規約省略        |        高 | 低      | 低     | 非推奨 | 事故る                  |

### 9.3 MCPを使うべきケース / 使わないケース

| 判断       | 例                                            |
| -------- | -------------------------------------------- |
| 使うべき     | チケット、最新API仕様、DBメタデータ、監視ログ、社内ドキュメント検索、CI状態    |
| 使わない方がよい | 固定化された規約、数ファイルで足りるルール、毎回読む必要がない長文、権限が過大な本番操作 |
| 要注意      | DB書き込み、チケット更新、クラウド操作、本番ログ取得                  |

MCP仕様では、toolsはモデルが自動発見・呼び出し可能な model-controlled なものとして説明される一方、trust & safety のためツール呼び出しを人間が拒否できるUIや確認プロンプトが推奨されている。

---

## 10. 推奨ディレクトリ構成

```text
project/
  AGENTS.md
  .codex/
    config.toml
    agents/
      framework-reviewer.toml
  .agents/
    skills/
      business-framework-review/
        SKILL.md
        references/
          review-checklist.md
  docs/
    architecture/
      overview.md
      layer-responsibility.md
      transaction-policy.md
    framework/
      glossary.md
      extension-points.md
      common-components.md
    rules/
      index.md
      auth.md
      transaction.md
      logging.md
      exception.md
      validation.md
      api.md
      batch.md
      test.md
    examples/
      golden-crud/
      golden-update-with-audit/
      golden-batch/
    review/
      code-review.md
      security-review.md
      framework-compliance.md
  specs/
    <feature-name>/
      brief.md
      requirements.md
      design.md
      tasks.md
  src/
  tests/
```

| ファイル                  | 書くこと                                                   | 書かないこと     |
| --------------------- | ------------------------------------------------------ | ---------- |
| `AGENTS.md`           | 参照先、検証コマンド、作業原則、禁止の入口                                  | 規約全文       |
| `.codex/config.toml`  | sandbox、approval、MCP、model                             | 業務仕様       |
| `docs/rules/index.md` | ルールID一覧、適用領域、参照先                                       | 詳細説明       |
| `docs/rules/*.md`     | 1ファイル1領域の詳細ルール                                         | 複数領域の雑多な規約 |
| `docs/examples/*`     | 代表実装、反例、比較                                             | 例外的・古い実装   |
| `docs/review/*`       | レビュー観点、重大度、確認方法                                        | 実装メモ       |
| `specs/*/brief.md`    | 目的、範囲、非ゴール                                             | 実装詳細       |
| `requirements.md`     | 受入条件、異常系、権限、監査                                         | クラス設計      |
| `design.md`           | 責務境界、File Structure Plan、TX、ログ、例外                      | 未承認の業務判断   |
| `tasks.md`            | 小タスク、Boundary、Depends、Rules、Tests、Implementation Notes | 長大な作業ログ    |

---

## 11. サンプルプロンプト集

### 11.1 `/kiro-discovery` 初期指示

```text
目的:
新規依頼を、spec不要 / 単一spec / 複数spec / 既存spec拡張に振り分ける。

使う場面:
業務要件がまだ粗く、実装に進めるべきか判断したい時。

プロンプト:
 /kiro-discovery
以下の業務要件を分析してください。
- 目的:
- 利用者:
- 業務価値:
- 想定画面/API:
- 影響しそうな既存機能:
- 非ゴール:

必ず以下を出してください。
1. spec要否の判断
2. 単一specかspec batchか
3. 適用候補のフレームワークルールID
4. 参照すべきgolden sample
5. 人間判断が必要な点
6. brief.md に残すべき scope / out-of-scope

期待する出力:
brief.md、必要ならroadmap.md、次に実行すべきコマンド。

人間が見るべきポイント:
scopeが広すぎないか、権限・監査・トランザクションが見落とされていないか。
```

### 11.2 フレームワークルール読込指示

```text
目的:
長文規約を貼らず、必要なルールだけ参照させる。

使う場面:
requirements/design/tasks の前。

プロンプト:
次の順に読んでください。
1. docs/framework/glossary.md
2. docs/rules/index.md
3. docs/examples/golden-crud/README.md

まだ実装しないでください。
この機能に適用される可能性があるルールIDを、
「適用」「非適用」「判断保留」に分けて表にしてください。

期待する出力:
Applicable Framework Rules表。

人間が見るべきポイント:
判断保留を勝手に適用/非適用にしていないか。
```

### 11.3 適用ルール一覧を出させる指示

```text
目的:
素のSpring実装や共通機能バイパスを防ぐ。

使う場面:
design.md 作成直前。

プロンプト:
このユースケースの設計に入る前に、適用されるフレームワークルールを列挙してください。
各ルールについて以下を出してください。
- Rule ID
- 適用理由
- 実装で守ること
- 参照すべきファイル
- テスト観点
- 判断保留事項

期待する出力:
Rule ID単位の設計前チェック表。

人間が見るべきポイント:
権限、監査、例外、TX、ログ、バリデーションが揃っているか。
```

### 11.4 要件定義を作らせる指示

```text
目的:
業務・権限・異常系・監査を requirements に落とす。

使う場面:
/kiro-spec-requirements。

プロンプト:
 /kiro-spec-requirements <feature-name>
requirements.md を作成してください。
必ず以下を含めてください。
- 正常系
- 入力チェック
- 業務バリデーション
- 権限/認可
- 監査ログ/操作ログ
- 業務例外/システム例外
- トランザクション失敗時
- 非機能要件
- 受け入れ条件
- 適用Rule ID

期待する出力:
EARS形式に近い requirements.md。

人間が見るべきポイント:
業務判断がAIの推測で埋められていないか。
```

### 11.5 design.md レビュー指示

```text
目的:
設計がフレームワーク準拠か検証する。

使う場面:
design.md 承認前。

プロンプト:
design.md をレビューしてください。
観点を分けてください。
1. requirements coverage
2. framework rule compliance
3. layer responsibility
4. transaction boundary
5. logging/audit
6. error handling
7. security
8. File Structure Plan妥当性
9. out-of-scope混入

期待する出力:
GO / NO-GO / HUMAN_DECISION_REQUIRED と findings。

人間が見るべきポイント:
NO-GOを無視してtasksに進んでいないか。
```

### 11.6 tasks.md レビュー指示

```text
目的:
自律実装可能な粒度にする。

使う場面:
/kiro-impl 前。

プロンプト:
tasks.md をレビューしてください。
各タスクに以下があるか確認してください。
- _Boundary:_
- _Depends:_
- _Rules:_
- _Tests:_
- touch list
- no-touch list
- 完了条件

1タスクが複数責務をまたぐ場合は分割案を出してください。

期待する出力:
タスクごとのGO/NO-GO、分割案。

人間が見るべきポイント:
大きすぎるタスク、境界の曖昧さ。
```

### 11.7 実装前チェック指示

```text
目的:
Codexが触る範囲を宣言させる。

使う場面:
各実装タスク開始直前。

プロンプト:
実装前チェックを行ってください。
まだファイルを変更しないでください。
以下を出してください。
- 実装対象タスク
- 変更予定ファイル
- 触ってはいけないファイル
- 適用Rule ID
- 参照するgolden sample
- 実行するテスト
- 判断保留事項

判断保留がある場合は実装に進まないでください。

期待する出力:
Pre-Implementation Checklist。

人間が見るべきポイント:
意図しないファイル変更が含まれていないか。
```

### 11.8 `/kiro-impl` 前の最終ゲート

```text
目的:
自律実装に入る前の承認。

使う場面:
/kiro-impl の直前。

プロンプト:
 /kiro-impl <feature-name> に進めるか最終判定してください。
requirements.md、design.md、tasks.md、docs/rules/index.md を照合し、
以下を判定してください。
- GO
- NO-GO
- HUMAN_DECISION_REQUIRED

NO-GOまたはHUMAN_DECISION_REQUIREDの場合、実装せず理由と修正案を出してください。

期待する出力:
Final Implementation Gate。

人間が見るべきポイント:
AIが未承認判断を勝手に解決していないか。
```

### 11.9 実装後の自己監査指示

```text
目的:
生成コードとルールIDを対応付ける。

使う場面:
タスク完了後、PR前。

プロンプト:
今回のdiffについて自己監査してください。
以下の表を作成してください。
- 変更ファイル
- 対応するrequirements ID
- 対応するRule ID
- 準拠内容
- テスト証跡
- 懸念点
- 人間レビューが必要な点

期待する出力:
Self Audit Report。

人間が見るべきポイント:
証跡のない「準拠しています」主張がないか。
```

### 11.10 independent review 用指示

```text
目的:
実装者と別視点でレビューする。

使う場面:
PR前、または `/kiro-impl` のreviewer pass相当。

プロンプト:
このdiffを独立レビューしてください。
実装者の意図説明ではなく、requirements.md、design.md、tasks.md、docs/rules/、golden sample、git diffだけを根拠にしてください。
観点:
1. 仕様準拠
2. ビジネスフレームワーク準拠
3. 境界違反
4. 差分最小性
5. テスト妥当性
6. 監査/ログ/例外/権限/TX
7. セキュリティ

期待する出力:
P0/P1/P2分類のfindings。

人間が見るべきポイント:
style指摘ではなく重大リスクに集中しているか。
```

### 11.11 バグ修正用指示

```text
目的:
場当たり修正を防ぐ。

使う場面:
障害、テスト失敗、レビュー指摘。

プロンプト:
バグ修正を root-cause-first で行ってください。
まだ修正しないでください。
以下を出してください。
- 再現手順
- 期待値
- 実際
- root cause
- 影響範囲
- 修正対象ファイル
- 触らないファイル
- 追加/修正するテスト
- 関連Rule ID

期待する出力:
Fix Plan。

人間が見るべきポイント:
症状隠しではなく根因修正か。
```

### 11.12 golden sample 抽出指示

```text
目的:
既存流儀をAIが参照しやすくする。

使う場面:
導入初期、横展開前。

プロンプト:
既存実装から golden sample 候補を抽出してください。
対象:
- 権限付き更新API
- 監査ログあり
- 業務例外あり
- transaction境界が明確
- テストが揃っている

各候補について、なぜgolden sampleに適するか、例外的実装ではないかを評価してください。

期待する出力:
golden sample候補表。

人間が見るべきポイント:
古い実装や例外対応をsample化していないか。
```

### 11.13 `AGENTS.md` 改善指示

```text
目的:
失敗を再発防止ルールに変換する。

使う場面:
同じ失敗が2回起きた後。

プロンプト:
今回の失敗を振り返り、AGENTS.md と docs/rules の改善案を出してください。
条件:
- AGENTS.mdは短く保つ
- 詳細はdocs/rulesへ分離
- ルールID、適用条件、代替実装、確認方法を含める
- 既存ルールとの重複を避ける

期待する出力:
AGENTS.md差分案、rules差分案。

人間が見るべきポイント:
一過性の指摘を恒久ルール化していないか。
```

### 11.14 フレームワーク規約を rules 化する指示

```text
目的:
長文規約をAIが参照可能な契約に変換する。

使う場面:
導入Phase 1。

プロンプト:
以下の既存規約を docs/rules 形式に再構成してください。
各ルールは以下の形式にしてください。
- Rule ID
- タイトル
- 適用条件
- ルール
- 禁止事項
- 代替実装
- 代表実装
- テスト観点
- レビュー観点
- 関連ルール

曖昧な規約は「要確認」として残し、勝手に補完しないでください。

期待する出力:
ID付きrules draft。

人間が見るべきポイント:
元規約の意味が変わっていないか。
```

---

## 12. 失敗パターンと対策

AI coding agent では、要求を越えてファイル削除・設定変更・範囲外編集を行う “overeager actions” が研究対象になっており、Codex CLI等を含む複数エージェントで範囲外行動が観測されている。したがって、scope宣言、sandbox、approval、no-touch list、worktree は実務上の安全策として重要である。

| 失敗パターン         | 原因            | 兆候                | 予防策                     | Codex/cc-sddでの具体的対処    | 人間の確認ポイント       |
| -------------- | ------------- | ----------------- | ----------------------- | ---------------------- | --------------- |
| フレームワークを無視     | 規約未読、sampleなし | 素のSpring実装        | Rule ID化                | Applicable Rules必須     | 共通部品経由か         |
| 似ているが微妙に違う     | sample不明      | 命名・例外が違う          | golden sample           | sample差分比較             | 例外実装を模倣していないか   |
| 責務境界を越える       | tasksが大きい     | Controllerに業務ロジック | `_Boundary:_`           | task分割                 | 層責務             |
| 共通機能バイパス       | 代替API不明       | 独自ログ/独自認可         | 禁止+代替                   | rules参照                | バイパスなし          |
| 例外・ログ・監査抜け     | happy path偏重  | 異常系テストなし          | requirementsテンプレ        | tests必須                | audit証跡         |
| happy pathだけ   | Done定義不足      | 正常系のみ             | test matrix             | RED→GREEN              | 異常/境界           |
| designとtasksズレ | 中間レビュー不足      | tasksが設計外         | 矛盾検出                    | pre-impl gate          | design coverage |
| tasksが大きすぎる    | spec粒度不良      | 1タスクで多数ファイル       | 1 task 1 boundary       | split案                 | タスクサイズ          |
| 実装が広がりすぎる      | no-touchなし    | 無関係diff           | touch/no-touch          | worktree + diff review | 差分最小性           |
| reviewがstyle偏重 | 観点未定義         | 命名だけ指摘            | review checklist        | 3分類review              | P0/P1中心         |
| ルール過多          | 優先度なし         | AIが全部列挙           | Rule index              | 適用/非適用表                | 重要ルール           |
| 仕様書が古い         | docs/code乖離   | 存在しないAPI参照        | code優先                  | validate-gap           | docs更新          |
| 人間判断までAI任せ     | gate不在        | 権限を推測             | HUMAN_DECISION_REQUIRED | final gate             | 判断保留            |

---

## 13. 導入ロードマップ

| Phase                        | 目的            | 作業                               | 成果物                    | 成功条件         | 避けるべきこと      |
| ---------------------------- | ------------- | -------------------------------- | ---------------------- | ------------ | ------------ |
| Phase 0: 現状棚卸し               | 暗黙知の把握        | 既存規約、代表実装、失敗例を集める                | 棚卸し表                   | 重要ルールが見える    | いきなり自律実装     |
| Phase 1: AGENTS.md と最小 rules | 最小ガード         | AGENTS短縮、rules/index作成           | AGENTS.md, rules draft | AIが参照先を理解    | AGENTS肥大化    |
| Phase 2: golden sample       | 模倣対象確立        | CRUD、更新、監査、バッチsample選定           | examples配下             | sampleで横展開可能 | 例外実装をsample化 |
| Phase 3: 小さなCRUDで試行          | 低リスク検証        | 1機能でdiscovery→impl               | spec一式、diff            | 手戻りが小さい      | 大規模案件で試す     |
| Phase 4: review観点標準化         | 品質ゲート         | code_review.md整備                 | review checklist       | 指摘が重大リスク中心   | styleだけ見る    |
| Phase 5: cc-sdd本格運用          | spec harness化 | full flow、Implementation Notes   | 運用手順                   | 中断復帰可能       | 人間gate省略     |
| Phase 6: Skills / MCP / 自動化  | 再利用化          | review skill、rules skill、MCP最小接続 | `.agents/skills`       | 長文prompt削減   | MCPつなぎすぎ     |
| Phase 7: 組織展開・メトリクス          | 継続改善          | 品質・手戻り・review指標化                 | dashboard, ADR         | 再発がrulesに戻る  | 個人技依存        |

---

## 14. 最終提言

### 14.1 最初に整備すべきもの

1. フレームワーク用語集
2. Rule ID付き `docs/rules/index.md`
3. golden sample
4. `AGENTS.md` の短い作業契約
5. review checklist
6. `/kiro-impl` 前の final gate

AGENTS.mdを最初に巨大化させるのは逆効果である。Codex公式のAGENTS.md設計でも、短く実用的な指示、階層化、参照ファイル分離が推奨されている。

### 14.2 最も費用対効果が高い施策

最も効くのは「golden sample + Rule ID + 適用ルール一覧」である。これにより、AIは抽象的な規約ではなく、具体的な既存実装と契約を参照して実装できる。

### 14.3 品質は上がるがコストも上がる施策

| 施策                       | 品質効果       | コスト |
| ------------------------ | ---------- | --- |
| spec batch               | 大規模整合性が上がる | 高   |
| independent review       | 見落とし減      | 中   |
| security / audit専用review | 重大事故防止     | 中高  |
| MCP連携                    | 外部情報が最新化   | 中高  |
| Skills化                  | 再現性向上      | 初期中 |

### 14.4 初期段階では避けるべき施策

* フレームワーク自体の自律改修
* 全社規約全文のAGENTS.md投入
* 本番系MCPの広範接続
* 複数subagentによる並列write-heavy実装
* 1スレッドで全プロジェクトを継続
* reviewなしの `/kiro-impl` 長時間放置

### 14.5 人間が必ず握るべき判断

| 判断           | 理由          |
| ------------ | ----------- |
| 権限・認可の最終判断   | セキュリティ事故に直結 |
| 監査ログ対象       | 法務・運用・監査要件  |
| トランザクション境界   | データ整合性・障害復旧 |
| 業務例外の扱い      | 利用者体験・業務責任  |
| フレームワーク拡張    | 全体設計思想に影響   |
| 非機能要件        | 性能・運用・監視    |
| 仕様とコード矛盾時の優先 | 組織判断が必要     |

### 14.6 Codex + cc-sdd に任せると効果が大きい領域

* 既存実装の調査
* 要件・設計・タスクの整合性チェック
* golden sampleに沿った横展開
* テストケース生成
* 小さな実装タスク
* diff最小のバグ修正
* ルール準拠の自己監査
* review checklistに基づく機械的レビュー

### 14.7 将来的に拡張すべき領域

Skills化すべきもの:

* ビジネスフレームワーク準拠review
* 業務例外・エラーコード追加手順
* 監査ログ追加手順
* バッチ追加手順
* API互換性review
* golden sample抽出
* Implementation Notes整理

MCP化すべきもの:

* 最新チケット情報
* APIカタログ
* DBスキーマ参照
* CI結果
* 社内ドキュメント検索
* 監視・ログ参照。ただし本番操作は承認必須。

Codex Skills は、繰り返し作業を `SKILL.md`、参照資料、スクリプト等にパッケージでき、Codex CLI / IDE extension / Codex app で利用できる。Agent Skills標準でも、skillは `SKILL.md` を中心に scripts / references / assets を持ち、必要時に段階的に読み込む progressive disclosure が説明されている。

---

## 15. 参考資料

* OpenAI Developers「Codex CLI」: Codex CLIの基本機能、インストール、ローカル実行、対応プランの説明。
* OpenAI Developers「Custom instructions with AGENTS.md」: AGENTS.mdの読込順序、階層化、32 KiB既定上限。
* OpenAI Developers「Codex Best practices」: context、planning、AGENTS.md、testing/review、MCP、Skills、thread管理、common mistakes。
* OpenAI Developers「Agent approvals & security」「Sandbox」: sandbox、approval、network制御、ローカル実行時の安全境界。
* OpenAI Developers「Agent Skills」: Codex Skills、progressive disclosure、skill構造、利用可能面。
* OpenAI Developers「Subagents」: subagentの用途、context pollution / context rot、明示起動、token cost、並列writeの注意。
* OpenAI Developers「Codex app features」: worktree、Git、複数スレッド、Skills、Automations。
* OpenAI Developers「Codex code review in GitHub」: PR review、AGENTS.md review guidance、P0/P1中心の設計。
* gotalab/cc-sdd README: v3系のAgent Skills、`/kiro-discovery`、`/kiro-impl`、boundary-first、File Structure Plan、Implementation Notes。
* gotalab/cc-sdd 日本語README: 同上の日本語一次情報。
* gotalab/cc-sdd Skill Reference: `/kiro-discovery`、`/kiro-impl`、review、debug、verify、Implementation Notes、1 task per iteration。
* gotalab/cc-sdd Why cc-sdd: cc-sddが向くケース、不要なケース、specを契約として扱う思想。
* Kiro公式 / AWSブログ: requirements、design、tasks、spec-driven development、hooks、steering、MCP。
* AGENTS.md 公式サイト: coding agents向けREADMEとしてのAGENTS.md、互換エコシステム、nested AGENTS.md。
* Model Context Protocol Specification: MCPの概要、hosts/clients/servers、resources/prompts/tools、trust & safety。
* Chroma「Context Rot」: 長文コンテキストでの非一様な性能劣化とcontext engineeringの重要性。
* Overeager Coding Agents: coding agentが benign task で範囲外操作を行う問題の研究。

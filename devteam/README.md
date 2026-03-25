# devteam

Multi-agent development team orchestration with file-based message queues.

AIエージェントで開発チームを編成し、マルチエージェントorchestrationとファイルベースメッセージキューを提供するClaude Codeプラグインです。

## インストール

```
/plugin marketplace add yn01/devteam
```

マーケットプレイス追加後、プラグインをインストールします:

```
/plugin install devteam
```

## コマンド

### /devteam:start

開発チームの全エージェントを起動します。

```
/devteam:start
```

- プロジェクトルートに `devteam.yaml` があればそれを、なければデフォルトテンプレートを使用
- 各エージェントのinboxディレクトリを作成
- tmuxセッションとしてエージェントを起動

### /devteam:send

指定したエージェントにメッセージを送信します。

```
/devteam:send <agent-name> <message>
```

例:
```
/devteam:send orchestrator 新しいAPI機能を実装してください
/devteam:send team-alpha-lead ユーザー認証モジュールの実装を優先してください
```

### /devteam:status

全エージェントのステータスとメッセージキューの状態を表示します。

```
/devteam:status
```

- 各エージェントの稼働状態（tmuxセッション）
- 未読メッセージ数
- 最新メッセージのプレビュー（先頭3行）

### /devteam:stop

全エージェントを停止し、未処理メッセージをアーカイブします。

```
/devteam:stop
```

- 全tmuxセッションを終了
- 未処理メッセージを `.claude/messages/archive/<timestamp>/` に移動

## devteam.yaml のカスタマイズ

プロジェクトルートに `devteam.yaml` を作成することで、チーム構成をカスタマイズできます。

### エージェントの追加

```yaml
agents:
  # 既存エージェントに加えて...
  security-auditor:
    model: claude-sonnet-4-6
    type: general-purpose
    role: Security Auditor
```

### モデルの変更

```yaml
agents:
  implementer-a:
    model: claude-opus-4-6  # より高性能なモデルに変更
    type: general-purpose
    role: Implementer A
```

### チーム構成の変更

```yaml
orchestrator:
  model: claude-opus-4-6
  role: Orchestrator
  directs: [doc-manager, team-alpha-lead]  # 直属を減らす

agents:
  team-alpha-lead:
    model: claude-sonnet-4-6
    type: general-purpose
    role: Team Alpha Lead
    directs: [implementer-a, implementer-c, reviewer-a]  # メンバー追加
```

### 利用可能なエージェントタイプ

| type | 説明 | 起動方法 |
|------|------|----------|
| `general-purpose` | 汎用エージェント | `claude --model <model>` |
| `explore` | コードベース探索特化 | `claude --model <model>` |
| `bash` | CLI tool (Codex等) | `codex` |

## ディレクトリ構造

```
devteam/
├── .claude-plugin/
│   └── plugin.json          # プラグインメタデータ
├── commands/
│   ├── start.md             # チーム起動コマンド
│   ├── send.md              # メッセージ送信コマンド
│   ├── status.md            # ステータス確認コマンド
│   └── stop.md              # チーム停止コマンド
├── agents/
│   ├── orchestrator.md      # Orchestratorエージェント定義
│   └── queue-monitor.md     # Queue Monitorエージェント定義
├── hooks/
│   └── hooks.json           # セッション開始時の未読通知フック
├── templates/
│   └── devteam.yaml         # デフォルトチーム構成テンプレート
├── LICENSE                  # MITライセンス
└── README.md                # このファイル
```

### メッセージキュー構造（実行時に生成）

```
.claude/messages/
├── inbox/
│   ├── orchestrator/        # Orchestratorの受信箱
│   ├── doc-manager/         # Doc Managerの受信箱
│   ├── release-manager/     # Release Managerの受信箱
│   ├── explorer/            # Explorerの受信箱
│   ├── team-alpha-lead/     # Team Alpha Leadの受信箱
│   ├── implementer-a/       # Implementer Aの受信箱
│   ├── reviewer-a/          # Reviewer Aの受信箱
│   ├── team-beta-lead/      # Team Beta Leadの受信箱
│   ├── implementer-b/       # Implementer Bの受信箱
│   └── reviewer-b/          # Reviewer Bの受信箱
└── archive/
    └── <timestamp>/         # アーカイブされたメッセージ
```

### メッセージファイル命名規則

```
<ISO timestamp>_from-<sender>.md
```

例: `2026-03-17T08-30-00_from-user.md`

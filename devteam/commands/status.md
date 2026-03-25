---
description: Show agent status and message queues
allowed-tools: Bash, Read, Glob, Grep
---

# /devteam:status

全エージェントのメッセージキュー状態を表示します。

## 手順

1. **Inboxディレクトリの走査**
   - `.claude/messages/inbox/` 配下の全サブディレクトリを走査する
   - 各ディレクトリ内の `.md` ファイル数をカウントする

2. **tmuxセッション状態の確認**
   - `tmux list-sessions 2>/dev/null | grep devteam-` で稼働中のセッションを確認する
   - 各エージェントのセッションが存在するかチェックする

3. **一覧表示**
   - エージェント名、セッション状態（稼働中/停止）、未読メッセージ数を一覧で表示する
   - 未読メッセージがある場合は、最新メッセージの先頭3行をプレビュー表示する
   - 最新メッセージの判定は、ファイル名のタイムスタンプでソートして最後のファイルとする

## 出力例
```
📊 DevTeam ステータス
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

エージェント          状態      未読
──────────────────────────────────────────
orchestrator         🟢 稼働中   2件
doc-manager          🟢 稼働中   0件
release-manager      🟢 稼働中   1件
explorer             🟢 稼働中   0件
team-alpha-lead      🟢 稼働中   3件
implementer-a        🟢 稼働中   1件
reviewer-a           🟢 稼働中   0件
team-beta-lead       🟢 稼働中   0件
implementer-b        🟢 稼働中   0件
reviewer-b           🔴 停止     0件

📬 未読メッセージプレビュー:

[orchestrator] 2件の未読 - 最新:
  > タスクAの進捗を報告します。
  > 実装は完了し、テストも通過しました。
  > レビュー待ちの状態です。

[release-manager] 1件の未読 - 最新:
  > v1.2.0のリリース準備を開始してください。

[team-alpha-lead] 3件の未読 - 最新:
  > implementer-aからの報告: API実装完了。
  > エンドポイント: /api/v1/users
  > テストカバレッジ: 85%
```

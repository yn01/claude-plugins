---
description: Start the multi-agent development team
allowed-tools: Read, Bash, Glob, Grep
---

# /devteam:start

Multi-agent development teamを起動します。

## 手順

1. **設定ファイルの読み込み**
   - プロジェクトルートに `devteam.yaml` があればそれを使用する
   - なければプラグインの `templates/devteam.yaml` を使用する
   - YAMLをパースして orchestrator / agents / message_queue の設定を取得する

2. **Inboxディレクトリの作成**
   - `message_queue.base_path` (デフォルト: `.claude/messages/inbox`) を基準に、全エージェントのinboxディレクトリを作成する
   - 作成対象: orchestrator + agents配下の全エージェント名
   - コマンド例:
     ```bash
     mkdir -p .claude/messages/inbox/orchestrator
     mkdir -p .claude/messages/inbox/doc-manager
     mkdir -p .claude/messages/inbox/release-manager
     mkdir -p .claude/messages/inbox/explorer
     mkdir -p .claude/messages/inbox/team-alpha-lead
     mkdir -p .claude/messages/inbox/implementer-a
     mkdir -p .claude/messages/inbox/reviewer-a
     mkdir -p .claude/messages/inbox/team-beta-lead
     mkdir -p .claude/messages/inbox/implementer-b
     mkdir -p .claude/messages/inbox/reviewer-b
     ```

3. **tmuxセッションの起動**
   - tmuxがインストールされていることを確認する（なければエラーメッセージを表示して終了）
   - 各エージェントをtmuxセッションとして起動する
   - セッション名は `devteam-<agent-name>` とする

   **Orchestrator:**
   ```bash
   tmux new-session -d -s devteam-orchestrator \
     "claude --model claude-opus-4-6 --system-prompt 'You are the Orchestrator agent. Read devteam.yaml to understand team structure. Monitor your inbox at .claude/messages/inbox/orchestrator/ for messages. Send messages to other agents by writing files to .claude/messages/inbox/<agent-name>/<timestamp>_from-orchestrator.md. Your role: task decomposition, delegation, progress tracking, and cross-team coordination. Do NOT implement code yourself - delegate to appropriate agents.'"
   ```

   **Sonnetエージェント** (doc-manager, release-manager, team-alpha-lead, implementer-a, team-beta-lead, implementer-b):
   ```bash
   tmux new-session -d -s devteam-<agent-name> \
     "claude --model claude-sonnet-4-6 --system-prompt 'You are the <role> agent. Monitor your inbox at .claude/messages/inbox/<agent-name>/ for messages. Send messages to other agents by writing files to .claude/messages/inbox/<target-agent>/<timestamp>_from-<agent-name>.md. Your role: <role description>.'"
   ```

   **Explorer:**
   ```bash
   tmux new-session -d -s devteam-explorer \
     "claude --model claude-haiku-4-5-20251001 --system-prompt 'You are the Explorer agent. Monitor your inbox at .claude/messages/inbox/explorer/ for messages. Send messages by writing files to .claude/messages/inbox/<target-agent>/<timestamp>_from-explorer.md. Your role: codebase exploration, file search, and information gathering.'"
   ```

   **Reviewer A/B (Codex CLI):**
   ```bash
   tmux new-session -d -s devteam-reviewer-a \
     "codex -a untrusted 'You are Reviewer A. Monitor .claude/messages/inbox/reviewer-a/ for code review requests. Write review results to the requesting agent inbox.'"
   tmux new-session -d -s devteam-reviewer-b \
     "codex -a untrusted 'You are Reviewer B. Monitor .claude/messages/inbox/reviewer-b/ for code review requests. Write review results to the requesting agent inbox.'"
   ```

4. **起動確認**
   - `tmux list-sessions | grep devteam-` で全セッションの起動を確認する
   - 起動したエージェント数を表示する
   - 起動に失敗したエージェントがあればエラーを報告する

## 出力例
```
🚀 DevTeam を起動します...
📋 設定ファイル: devteam.yaml
📁 Inboxディレクトリを作成しました (10 agents)
🤖 エージェントを起動中...
  ✅ orchestrator (claude-opus-4-6)
  ✅ doc-manager (claude-sonnet-4-6)
  ✅ release-manager (claude-sonnet-4-6)
  ✅ explorer (claude-haiku-4-5-20251001)
  ✅ team-alpha-lead (claude-sonnet-4-6)
  ✅ implementer-a (claude-sonnet-4-6)
  ✅ reviewer-a (codex)
  ✅ team-beta-lead (claude-sonnet-4-6)
  ✅ implementer-b (claude-sonnet-4-6)
  ✅ reviewer-b (codex)
🎉 DevTeam 起動完了！ 10/10 エージェントが稼働中です。
```

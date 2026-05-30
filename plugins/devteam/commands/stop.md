---
description: Stop all agents and archive messages
allowed-tools: Bash, Glob
---

# /devteam:stop

DevTeamの全エージェントを停止し、メッセージをアーカイブします。

## 手順

1. **tmuxセッションの終了**
   - `tmux list-sessions 2>/dev/null | grep devteam-` で稼働中のdevteamセッションを取得する
   - 各セッションを `tmux kill-session -t <session-name>` で終了する
   - 全セッションを一括終了する場合: `tmux kill-session -t devteam-<agent-name>` をループで実行する
   - コマンド例:
     ```bash
     for session in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^devteam-'); do
       tmux kill-session -t "$session"
     done
     ```

2. **未処理メッセージのアーカイブ**
   - アーカイブ先ディレクトリ: `.claude/messages/archive/<ISO timestamp>/`
   - ISO timestampのフォーマット: `YYYY-MM-DDTHH-MM-SS`
   - `.claude/messages/inbox/` 配下の全ディレクトリを走査する
   - 各ディレクトリ内に `.md` ファイルが存在する場合:
     - `.claude/messages/archive/<timestamp>/<agent-name>/` ディレクトリを作成する
     - ファイルを移動する
   - コマンド例:
     ```bash
     ARCHIVE_DIR=".claude/messages/archive/$(date -u +"%Y-%m-%dT%H-%M-%S")"
     for agent_dir in .claude/messages/inbox/*/; do
       agent_name=$(basename "$agent_dir")
       if [ "$(ls -A "$agent_dir" 2>/dev/null)" ]; then
         mkdir -p "$ARCHIVE_DIR/$agent_name"
         mv "$agent_dir"* "$ARCHIVE_DIR/$agent_name/"
       fi
     done
     ```

3. **停止確認**
   - 終了したセッション数を表示する
   - アーカイブしたメッセージ数を表示する

## 出力例
```
🛑 DevTeam を停止します...
  ❌ orchestrator セッション終了
  ❌ doc-manager セッション終了
  ❌ release-manager セッション終了
  ❌ explorer セッション終了
  ❌ team-alpha-lead セッション終了
  ❌ implementer-a セッション終了
  ❌ reviewer-a セッション終了
  ❌ evaluator-a セッション終了
  ❌ team-beta-lead セッション終了
  ❌ implementer-b セッション終了
  ❌ reviewer-b セッション終了
  ❌ evaluator-b セッション終了

📦 未処理メッセージをアーカイブしました
  アーカイブ先: .claude/messages/archive/2026-03-17T08-45-00/
  アーカイブ数: 6件

🏁 DevTeam 停止完了。12 セッションを終了しました。
```

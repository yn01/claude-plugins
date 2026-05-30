---
description: Send a message to an agent
argument-hint: <agent-name> <message>
allowed-tools: Bash, Write
---

# /devteam:send

指定したエージェントにメッセージを送信します。

## 引数
- `<agent-name>`: 送信先エージェント名
- `<message>`: 送信するメッセージ内容

## 使用方法
```
/devteam:send <agent-name> <message>
```

## 手順

1. **引数の検証**
   - `<agent-name>` が指定されていない場合はエラーを表示する
   - `<message>` が指定されていない場合はエラーを表示する
   - `.claude/messages/inbox/<agent-name>/` ディレクトリが存在するか確認する
   - 存在しない場合は「エージェント '<agent-name>' が見つかりません。/devteam:start で起動してください」と表示する

2. **メッセージファイルの作成**
   - ファイルパス: `.claude/messages/inbox/<agent-name>/<ISO timestamp>_from-user.md`
   - ISO timestampのフォーマット: `YYYY-MM-DDTHH-MM-SS` (ファイル名に使用可能な形式)
   - ファイル内容: `<message>` をそのまま書き込む
   - コマンド例:
     ```bash
     TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")
     echo "<message>" > ".claude/messages/inbox/<agent-name>/${TIMESTAMP}_from-user.md"
     ```

3. **送信確認**
   - 送信完了メッセージを表示する

## 出力例
```
📨 メッセージを送信しました
  宛先: orchestrator
  ファイル: .claude/messages/inbox/orchestrator/2026-03-17T08-30-00_from-user.md
```

## エラー例
```
❌ エラー: エージェント名を指定してください
使い方: /devteam:send <agent-name> <message>
```

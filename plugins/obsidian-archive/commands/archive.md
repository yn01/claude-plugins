# /obsidian-archive:archive

手動で即時保存を実行するコマンドです。現在のセッションサマリーを生成してObsidianに保存します。

## 使い方

```
/obsidian-archive:archive
```

## 動作

以下のステップを実行してください:

1. **設定読み込み**: プラグインディレクトリの `obsidian-archive.json` を読み込む
   - `vault_path`: Obsidian vaultのパス（デフォルト: `~/Documents/Obsidian/Claude-Dev`）
   - `folder`: 保存フォルダ（デフォルト: `Sessions`）
   - `filename_format`: ファイル名フォーマット（デフォルト: `YYYY-MM-DD_HH-mm_{project}`）
   - `include_git_diff`: git diffを含めるか（デフォルト: `true`）
   - `tags`: タグリスト（デフォルト: `["claude-code", "session"]`）

2. **ディレクトリ確認**: `{vault_path}/{folder}` が存在しない場合は作成する

3. **ファイル名生成**: `filename_format` に従ってファイル名を生成する
   - `YYYY` → 現在の年（例: 2026）
   - `MM` → 現在の月（例: 03）
   - `DD` → 現在の日（例: 18）
   - `HH` → 現在の時（例: 14）
   - `mm` → 現在の分（例: 30）
   - `{project}` → カレントディレクトリ名

4. **サマリー生成**: `obsidian-archive:summarizer` エージェントを呼び出してセッションサマリーを生成する

5. **ファイル保存**: 生成されたサマリーを `{vault_path}/{folder}/{filename}.md` に保存する

6. **完了通知**: 保存したファイルの絶対パスをユーザーに表示する

## 出力例

```
✓ セッションサマリーを保存しました:
  ~/Documents/Obsidian/Claude-Dev/Sessions/2026-03-18_14-30_obsidian-archive.md
```

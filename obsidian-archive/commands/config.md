# /obsidian-archive:config

現在の設定を表示・更新するコマンドです。

## 使い方

### 設定の表示
```
/obsidian-archive:config
```

### 設定の更新
```
/obsidian-archive:config <key> <value>
```

## 動作

### 引数なしの場合（設定表示）

1. プラグインディレクトリの `obsidian-archive.json` を読み込む
2. 全設定項目を整形して表示する

**出力例:**
```
現在の obsidian-archive 設定:

  vault_path             : ~/Documents/Obsidian/Claude-Dev
  folder                 : Sessions
  filename_format        : YYYY-MM-DD_HH-mm_{project}
  auto_save_interval_minutes : 30
  include_git_diff       : true
  tags                   : ["claude-code", "session"]
```

### 引数ありの場合（設定更新）

1. 第1引数をキー名、第2引数以降を値として解釈する
2. `obsidian-archive.json` を読み込んで対象キーを更新する
3. 更新後のJSONを `obsidian-archive.json` に書き戻す
4. 変更内容を表示する

**使用例:**
```
/obsidian-archive:config vault_path ~/Documents/Obsidian/MyVault
/obsidian-archive:config folder WorkSessions
/obsidian-archive:config auto_save_interval_minutes 60
/obsidian-archive:config include_git_diff false
/obsidian-archive:config tags ["claude-code", "work", "session"]
```

**更新後の出力例:**
```
✓ 設定を更新しました:
  vault_path: ~/Documents/Obsidian/Claude-Dev → ~/Documents/Obsidian/MyVault
```

## 設定項目一覧

| キー | 型 | デフォルト値 | 説明 |
|------|-----|-------------|------|
| `vault_path` | string | `~/Documents/Obsidian/Claude-Dev` | ObsidianのVaultパス |
| `folder` | string | `Sessions` | Vault内の保存フォルダ名 |
| `filename_format` | string | `YYYY-MM-DD_HH-mm_{project}` | ファイル名フォーマット |
| `auto_save_interval_minutes` | number | `30` | 自動保存間隔（分） |
| `include_git_diff` | boolean | `true` | git diffをサマリーに含めるか |
| `tags` | array | `["claude-code", "session"]` | ノートに付与するタグ |

## 注意事項

- `obsidian-archive.json` が存在しない場合はデフォルト値を表示する
- 値の型は自動的に判定する（数値・真偽値・配列・文字列）
- 配列はJSON形式で指定する（例: `["tag1", "tag2"]`）

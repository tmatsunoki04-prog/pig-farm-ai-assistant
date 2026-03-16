# 養豚現場相談AI MVP AI出力JSON仕様

将来的な構造化保存やデータ活用を見据え、バックエンド（AI API）からフロントエンドへ返すJSONの固定フォーマットを定義する。
※匿名化や永続保存の仕組み自体はMVPでは深追いしないが、この構造でデータを授受する。
※`raw_input` や一時画像は永続保存対象外とし、このJSON仕様はレスポンスまたは構造化データ保存時のフォーマットとする。

## JSONフォーマット定義

```json
{
  "consultation_id": "string", // 相談のユニークID（UUIDなど）
  "timestamp": "string",       // ISO 8601形式の日時（例: "2026-03-13T10:00:00Z"）
  "raw_input": "string",       // ユーザーからの入力テキスト（そのまま記録。ただし永続保存対象外。画面表示用）
  "has_image": true,           // 画像が添付されたかどうか(boolean)
  "image_storage_mode": "temporary", // 画像の保存モード（temporary または none を設定。簡潔に扱う）
  "privacy_mask_applied": true,// マスキングが適用されたかどうか(boolean)。簡易マスキング実行時に true を返す。
  "concern_category": "string",// 内部分類（疾病 / 環境 / 飼料 / 管理 / 繁殖 / 設備 / その他 のいずれか）
  "suspected_factors": [
    "string"                   // 内部的な判断要素（例：「哺乳豚の下痢」など）1〜複数
  ],
  "action_items": [
    "string"                   // 画面表示用：「まずやること」（1〜3項目を配列で返す）
  ],
  "urgency": "string",         // 画面表示用：「緊急度」（すぐ獣医師相談 / 今日中に確認 / まず様子確認 など）
  "reason": "string",          // 画面表示用：「理由」（1〜2文）
  "vet_consult_needed": true,  // boolean: 獣医師への相談が必要かどうか
  "vet_consult_message": "string", // 画面表示用：「獣医師への相談目安」メッセージ（不要な場合は null または空文字）
  "optional_questions": [
    "string"                   // 画面表示用：「追加で分かれば役立つ情報」（配列、なくてもよい）
  ],
  "image_card_id": "string"    // 将来用：画像カード呼び出し用ID（MVP時は "dummy_card_01" などの固定値や null で可）
}
```

## エラー時のレスポンス仕様
HTTPステータスコード（400や500）と共に以下のJSONを推奨。
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "入力テキストが空です。"
  }
}
```

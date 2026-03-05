# Mailer TODO

個人DJミックス配信サービスのメール機能改善タスク。
ミニマル・標準準拠・可読性を重視。

## P0: 標準準拠・正確性

- [x] Verification Email を日本語化（Notification Email と言語統一）
- [x] Webhook secret 未設定時のステータスコードを 503 に変更（500 は誤り）
- ~~pixelBasedPreset 適用~~ 不要: テンプレートは既にすべて px ベースの値を使用

## P1: コード品質

- [x] index.ts のモジュール分割（handlers / lib に責務分離）

## P2: 将来検討（現時点では不要）

- [ ] Soft bounce / Hard bounce の区別（現状は全て hard_bounce で suppression）
- [ ] 配信ステータス確認 API（管理用）
- [ ] React Email dev server スクリプト追加

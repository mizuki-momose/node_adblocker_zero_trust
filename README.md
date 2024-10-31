# Node Adblock Zero Trust
Cloudflare Zero TrustのFirewallで簡単にAdBlockなDNSポリシーを設定できます。

ルールは[280blocker](https://280blocker.net/download/)様のリストを使用しています、感謝。

## usage
事前に何でもいいのでDNSのルールを作成しておいてください。

.envファイルを作成して下記情報を書き込んでください。

```
API_TOKEN= # https://dash.cloudflare.com/profile/api-tokensで取得
ACCOUNT_ID= # ダッシュボードにログインしたときのURLにある文字列
RULE_ID= # Firewall > Firewall policiesのPolicy ID
YEAR= # 2024
MONTH= # 10
```

下記コードを実行

```
npm run start
```

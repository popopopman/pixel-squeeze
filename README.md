# Pixel Squeeze

ブラウザだけで画像を圧縮・リサイズ・WebP/JPEG/PNGに変換できる無料ツールです。ファイルをアップロードしないため、画像は端末の外へ送信されません。

公開先: <https://popopopman.github.io/pixel-squeeze/>

## 機能

- JPEG / PNG / WebP の圧縮と形式変換
- 画質と長辺サイズの調整
- 変換前後のプレビュー、ファイルサイズ、削減率の表示
- キーボード・スクリーンリーダーを含む標準操作と、`prefers-reduced-motion` への対応
- Motionによる控えめで保守しやすい画面遷移

## 開発

```bash
docker compose up dev
# http://localhost:3000

docker compose exec dev pnpm lint
docker compose exec dev pnpm test
docker compose down
```

Dockerを使わない場合:

```bash
corepack enable
pnpm install
pnpm dev
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

公開成果物と同じ静的サイトのプレビューは次で起動できます。

```bash
docker compose --profile preview up --build preview
# http://localhost:8080
```

## 品質と公開

- **ESLint 9 flat config**: Next.js Core Web Vitals と TypeScript ルールを適用
- **Prettier**: フォーマットの唯一の基準。ESLintの整形ルールは `eslint-config-prettier` で無効化
- **TypeScript**: `strict` とソース専用の `tsc --noEmit` をlint工程に含める（Next.js生成物はNext本体のビルド検査に任せる）
- **Vitest**: 横長・縦長・正方形・拡大禁止・丸め・不正な寸法と容量表示を対象にした単体テスト
- **GitHub Actions**: PRではフォーマット、lint、テスト、ビルドを確認。`main`へのpushでは同じ検査後にGitHub Pagesへ静的公開
- **Dependabot**: npmパッケージとGitHub Actionsを週次で確認し、更新PRを作成

GitHub Pagesはリポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定してください。

## Google AdSense

GitHubの `ADSENSE_CLIENT` Secret に `ca-pub-...` 形式のパブリッシャーIDを登録すると、公開ビルドだけにAdSenseの読み込みタグとアカウント用metaタグを出力します。ローカル開発では `.env.local` に `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-...` を設定してください。

AdSense管理画面でこの公開サイトを審査・追加し、**自動広告**を有効にすると広告表示をGoogle側で管理できます。固定の広告枠を使う場合は、別途発行した広告スロットIDを使って追加してください。

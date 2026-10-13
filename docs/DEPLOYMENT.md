# GitHub Pages deployment / GitHub Pages 部署

This document describes the real build and acceptance process. A localhost test is not evidence that GitHub Actions or the public website succeeded. Do not create `v0.1.0` until the pushed commit passes CI, Pages deployment and public browser acceptance.

## Workflow and repository settings

`.github/workflows/quality-and-pages.yml` runs on pushes to `main`, pull requests to `main`, and manual dispatch. The quality job installs Node.js 24.19.0 and the manifest's pnpm 11.25.0 using a frozen lockfile, then runs `pnpm check` and the complete production Chromium E2E at the real repository path. Only Chromium and its system dependencies are installed.

The deployment job requires the quality job to succeed and only runs on `main`, outside pull requests. It uses GitHub's [configure-pages](https://github.com/actions/configure-pages), [upload-pages-artifact](https://github.com/actions/upload-pages-artifact) and [deploy-pages](https://github.com/actions/deploy-pages). Only deployment receives Pages write and OIDC permissions; Actions read permits reading the verified artifact. Deployment concurrency serializes Pages updates. No `continue-on-error` or personal deployment token is used.

Enable **Settings → Pages → Source → GitHub Actions** on the actual repository. The owner may also enable private vulnerability reporting under **Settings → Code security** so that SECURITY's private reporting route is available. No custom domain is assumed.

普通 PR 僅執行品質檢查，沒有部署權限；main 的品質檢查與建置成功後才上傳 dist 並部署。失敗時保留瀏覽器診斷七天，這些測試資料不屬於 Pages 網站。

## Repository paths and refresh

Vite reads validated `BUGZOO_BASE_PATH`; development defaults to `/`. The workflow derives `/actual-repository-name/` from `GITHUB_REPOSITORY`, except owner `.github.io` repositories, which use `/`. Favicon, brand assets and lazy JavaScript/CSS use this prefix. The deploy job checks the resulting path against official Pages metadata and fails if they differ, instead of publishing an incorrectly based site.

Hash routes such as `/actual-repository-name/#minusmole` request the same static index on refresh; no server rewrite is required. Unknown hash routes fall back to the home page. Arbitrary server-side paths such as `/actual-repository-name/minusmole` are not supported. A copied `.nojekyll` is included in the dist-only artifact.

If adding a custom domain later, update and validate the actual base rather than assuming the repository path still applies. Do not hard-code an unverified GitHub username or Demo URL.

## Local production acceptance

```powershell
$env:BUGZOO_BASE_PATH = '/bugzoo-teach-the-robots/'
pnpm build
$env:BUGZOO_E2E_BASE_URL = 'http://127.0.0.1:4173/bugzoo-teach-the-robots/'
$env:BUGZOO_E2E_PRODUCTION = '1'
$env:BUGZOO_E2E_CHANNEL = 'chrome'
pnpm test:e2e
```

Use a real installed browser or install Playwright Chromium first. The runner starts preview itself; leave port 4173 free. Remove these process-level variables when returning to root-path development.

## Public-site acceptance

After a successful deployment, obtain its real URL from the Pages API or deployment output. Set `BUGZOO_E2E_BASE_URL` to that URL and `BUGZOO_E2E_EXTERNAL=1`; this disables the local server and executes the same true game, storage, language and download cases against the public site. Use fresh contexts and synthetic examples; do not upload personal learning records. Browser errors, warnings, failed HTTP responses and unexpected cross-origin requests fail acceptance.

Do not count offline tests as public acceptance. Record the real commit SHA, Actions run, Pages result, actual public URL and browser results in the release record. A formal Release must reference the verified commit; never force-push or replace an existing tag.

## Acceptance record

The Phase Eight record is added here only after the corresponding action has actually run. Current historical quality evidence is retained in [VERIFICATION](VERIFICATION.md); the publication checklist is [RELEASE_CHECKLIST](RELEASE_CHECKLIST.md).

# Security and Privacy / 安全與隱私

BugZoo is a browser-based educational game. Its learning records and language preference are stored locally in the browser, and the learning passport is generated and downloaded locally. The application does not send these records to a project backend. Hosting providers still receive normal website requests; this statement is about application learning data, not a promise that hosting access logs do not exist.

BugZoo 的學習紀錄及語言偏好保存在瀏覽器本地，學習護照也在本地產生及下載。應用程式不把紀錄上傳至專案後端。網站託管服務仍會收到一般網頁請求，這不代表託管服務沒有存取紀錄。

## Reporting a vulnerability / 回報漏洞

Please do not put exploit details, secrets, or private learning records in a public issue or pull request.

Private vulnerability reporting is enabled for the published BugZoo repository, as verified on 2026-10-14. Open [the private advisory form](https://github.com/AndyLamyinwik/bugzoo-teach-the-robots/security/advisories/new), or use **Security → Advisories → Report a vulnerability**. Include affected code or version, impact, and minimal reproduction steps with synthetic data. Fork owners must enable this feature on their own repositories.

If that form is unavailable and no maintainer has published another private contact method, open an issue containing only a request to enable private vulnerability reporting. Do not include the vulnerability details. Wait for an available private reporting channel before sharing sensitive information. For exposed credentials, also revoke or rotate them through the issuing service promptly.

請勿在公開 Issue 或 PR 貼出利用方式、憑據或私人學習資料。正式 BugZoo 倉庫已啟用私人漏洞回報，於 2026-10-14 核對；可使用上方私人表單或 **Security → Advisories → Report a vulnerability**，提供受影響程式碼／版本、影響及使用虛構資料的最小重現步驟。Fork 的所有者須自行啟用。

若表單不可用，且維護者未公布其他私人聯絡方式，僅建立「請啟用私人漏洞回報」的 Issue，不提供漏洞細節，待私人管道可用後再回報。已外洩的憑據亦應立即向發行服務撤銷或更新。

## Maintenance and scope / 維護範圍

Security fixes target the current `main` branch. This project does not promise long-term support for earlier snapshots or a response deadline. A release or completed learning passport is not a security certification or evidence of educational effectiveness.

Useful reports include script injection, unsafe handling of stored or exported data, unintended external transmission, sensitive files in published artifacts, and dependency vulnerabilities with a concrete impact. Mathematical bugs and accessibility issues are also welcome through ordinary issue reports when they do not expose private data.

安全修復以目前 `main` 分支為主，不承諾舊快照的長期支援或固定回覆期限。歡迎回報腳本注入、儲存／匯出資料處理風險、不預期的外部傳輸、發布產物內的敏感檔案，以及具有實際影響的依賴漏洞。沒有隱私風險的數學或無障礙問題可使用一般 Issue。

## Safe development / 安全開發

- Treat browser storage and user input as untrusted, even when created by an older app version. Reconstruct lesson state through validated domain commands.
- Never commit tokens, passwords, browser profiles, personal learning exports, or local environment files. Public examples and tests must use synthetic data.
- Keep exact mathematics, local-only exports, and the absence of analytics or external AI requests intact. Changes affecting privacy require an explicit proposal and review.
- If progress cannot be read or safely migrated, preserve the original record until the user confirms a reset. Never use `localStorage.clear()` to erase unrelated data.

外部輸入與本地儲存都須驗證；測試使用虛構資料，避免提交敏感檔案。隱私行為的變更須先提出並接受審查。無法安全還原的舊進度應保留至使用者確認重設，不能刪除其他網站或功能的資料。

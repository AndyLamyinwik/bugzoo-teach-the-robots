# BugZoo 發布準備清單

第八階段發布準備，2026-10-14。此清單記錄本地可審查的成果與發布守衛；真實倉庫、CI、Pages、公開網站及 Release 狀態以 DEPLOYMENT、GitHub Actions 與 Releases 的實際記錄為準。使用者已授權本階段正常發布，禁止強制推送、覆寫其他專案或刪除遠端內容。

## 本地已驗證

- [x] 使用者確認 MIT 版權名稱 `2026 AndyLamyinwik`；標準 LICENSE、雙語 README、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY 與精簡 Issue／PR 範本完整。
- [x] 保留原有 355 個 Vitest 與 16 個 E2E；新增 8 個 base／中繼資料測試及 1 個發布 E2E。
- [x] frozen-lockfile 安裝及 pnpm check 通過：363 個測試／25 檔，零警告 lint、Strict TypeScript、格式與正式建置。
- [x] 根路徑 34／34 E2E，正式 `/bugzoo-teach-the-robots/` 子路徑 34／34 E2E；四課程通關、保存、重設、雙語、Markdown、鍵盤、縮減動畫及資源格式均通過。
- [x] 320、375、768、1280、1440px 七頁沒有頁面水平溢出；桌面／320px 五步流程通過。未知 hash 回到首頁，已知深連結刷新不依賴伺服器重寫。
- [x] 原創品牌 SVG、1200×630 PNG、favicon 與雙語 title／description／Open Graph；文件截圖來自乾淨 context 的虛構示例，經目視檢查。
- [x] 暫存來源檔案已排除 node_modules、dist、私人護照、.qa、trace、報告、金鑰與環境檔；限定掃描未發現秘密值或個人本機路徑。
- [x] 學習資料仍在瀏覽器本地，匯出由 Blob 產生；沒有新增追蹤、廣告、AI、後端或外部資料請求。託管服務仍收到一般網頁請求。
- [x] CI 設定使用鎖定工具版本與 Chromium，品質失敗不得部署；main、needs、最小權限、官方 Pages Actions 與 concurrency 均已設定。設定完成不代表遠端工作已通過。
- [x] Git 初始化 main，帳號與既有授權一致；Commit 使用已驗證 GitHub 身分的 noreply 地址，避免公開私人信箱。

## 外部發布守衛

- [x] 真實公開倉庫、main 正常推送、指定 Topics 與私人漏洞回報設定已核對。
- [x] Ubuntu 品質工作、官方 Pages 部署及真實公開 URL 的 34 次 E2E 已通過；實際 run／job 見 DEPLOYMENT。
- [x] README Demo 只在公開網站驗收成功後加入；Windows 直連失敗如實記錄，沒有算成通過。
- [x] 正式 Release 仍須指向最後完整 CI／公開驗收成功的 Commit，不可提前發布或覆寫既有 tag。

1. 檢查真實目標倉庫；新建時不得 auto-init 產生衝突歷史。只推送已審查的來源與文件，不強制推送。
2. 確認實際 GitHub Actions 品質工作及 Pages 部署結果；啟用 Pages 的 GitHub Actions source，建置子路徑須吻合官方 Pages metadata。
3. 對 API 返回的真實公開 URL 執行完整 E2E，驗證四課程、保存、刷新、語言、護照、下載、桌面、320px、Console 與資源 404。
4. 僅在推送、CI、Pages 及公開網站驗收成功後加入 Demo 並建立 v0.1.0；Release 指向已驗證 commit，不虛構版本歷史。
5. 不在原始碼、Remote URL、文件或命令輸出寫入 Token。保持私人漏洞回報管道可用；若不能啟用，依 SECURITY 的非敏感聯絡請求流程處理。

## 後續限制（不阻擋本次已驗範圍）

Firefox／WebKit、真實手機、螢幕閱讀器、完整 WCAG 審核、整個瀏覽器程序重啟、Playwright UI 人工操作與教育效果研究，仍需獨立驗證。沒有通用舊版本遷移；不能安全還原時保留原資料至確認重設。依賴授權記錄只涵蓋已檢查範圍，不能代替完整法律或安全認證。

歷史證據見 [VERIFICATION](VERIFICATION.md)，當次發布見 [DEPLOYMENT](DEPLOYMENT.md)，素材來源見 [ASSETS](ASSETS.md)。

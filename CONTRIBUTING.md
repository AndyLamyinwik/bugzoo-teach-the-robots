# Contributing to BugZoo / 參與 BugZoo

Thank you for helping students teach the wrong robots. Bug reports, accessibility improvements, translations, clearer explanations, and tested code changes are welcome. Please read [AGENTS.md](AGENTS.md), [the architecture](docs/ARCHITECTURE.md), and [the code of conduct](CODE_OF_CONDUCT.md) before changing code.

歡迎回報問題、改善無障礙、補充翻譯、改進教學說明或提交經過驗證的程式碼。開始前請閱讀上述專案規範、架構及行為準則。大型功能和新課程請先提出 Issue，與維護者確認範圍；自動化開發任務只執行使用者明確指定的階段。

## Local development / 本地開發

Use Node.js 24 LTS and **pnpm 11.25.0**, matching `package.json`. Install dependencies from the committed lockfile:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The development server prints its local URL. `pnpm build` creates `dist/`; `pnpm preview` serves that build locally. Do not commit dependencies, builds, browser profiles, screenshots from failed tests, private learning progress, or credentials.

請使用與 `package.json` 相符的版本及鎖定依賴。不要提交 `node_modules/`、`dist/`、瀏覽器個人資料、測試失敗產物、私人學習進度或憑據。

## Verification / 驗證

```sh
pnpm format
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` runs ESLint, Vitest, Prettier checks, Strict TypeScript checks, and a production build. Playwright automatically starts a local server and runs desktop and 320px Chromium projects. Installing Chromium is a one-time setup per environment; on Linux, use `pnpm exec playwright install --with-deps chromium` when system dependencies are needed.

An already installed Chrome can be selected on Windows PowerShell:

```powershell
$env:BUGZOO_E2E_CHANNEL = 'chrome'
pnpm test:e2e
```

Before delivery, run the complete E2E suite twice consecutively with zero retries. Report the actual commands, browser, results, and any environment limitation in the pull request. Never mark an unexecuted check as passed. Additional useful commands are `pnpm test:watch`, `pnpm typecheck`, `pnpm lint`, and `pnpm test:e2e:ui`.

交付前請連續兩次執行完整 E2E，維持零重試，並在 PR 說明實際結果及環境限制。修復失敗後重新檢查，不得刪除或跳過有效測試，也不能修改數學預期來掩蓋回歸。

## Code and lesson design / 程式碼與課程設計

- Keep mathematics and the teaching engine as pure functions, independent of React, the DOM, and browser storage. Use exact domain representations, not floating-point tolerance for correctness.
- Reuse the existing shared five-step engine. A proposed robot should define real misconception rules, input validation, answer equivalence, counterexamples, and deterministic unseen verification questions. Agree on scope before implementation; avoid speculative frameworks.
- A correct example may eliminate hypotheses only after input and answer validation. An example that cannot distinguish rules must not claim progress. Completion requires the correct rule and three unseen questions passed by both student and robot.
- Preserve all four existing lessons, regression tests, original fraction representations, money rounding policy, number-line meaning, and ChanceCrow's physical-ball sampling rules.
- Add both Traditional Chinese and English messages and accessible labels. Test keyboard navigation, visible focus, reduced motion, and narrow layouts when affected.
- Treat stored data as untrusted. Changes to persisted contracts require explicit schema and lesson versions, safe validation, and appropriate migration or preservation tests.
- Follow the existing TypeScript, ESLint, and Prettier settings. Prefer small, readable changes and meaningful behavioral tests. Do not add dependencies without a concrete need.

數學、假設排除與完成條件必須保持可解釋、可重現。新機器人先提出教學目標及真實迷思規則，再確認開發範圍。介面、課程文案及無障礙標籤須補齊繁體中文與英文；儲存契約變更須包含版本策略及測試。不加入追蹤、付費 AI、登入、後端或雲端功能，除非專案明確核准新範圍。

## Issues and pull requests / Issue 與 Pull Request

For a bug, include reproduction steps, expected and actual behavior, affected lesson, browser, viewport, and language. Share only sanitized screenshots or logs. Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue containing exploit details.

For a feature, explain the educational or maintenance problem and a small proposed solution. Claims of improved learning outcomes need supporting evidence; do not present the learning passport as a certification of real-world ability.

Fork the repository, create a focused branch, and open a pull request against `main`. Describe the final behavior, relevant decisions, and actual validation. Keep unrelated refactors out of the change. Review the project's [license](LICENSE) and contribute only material you have the right to share under compatible terms; disclose any third-party asset source and license.

回報問題時提供重現步驟、預期與實際結果、課程、瀏覽器、視窗尺寸及語言。提交 PR 時說明變更用途與實測結果，避免無關重構；只提交有權分享且授權相容的內容，第三方素材須標示來源。敏感漏洞請依安全政策回報。

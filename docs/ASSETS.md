# Visual assets and attribution / 視覺素材來源

BugZoo keeps its product illustrations in editable SVG and component code. This inventory describes the files inspected for publication; it is not a legal determination of copyright ownership.

| Asset                                             | Source                                                                 | Implementation                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| FractionFox, DiscountPanda, MinusMole, ChanceCrow | [`RobotPortrait.tsx`](../src/components/RobotPortrait.tsx)             | Four project-specific illustrations drawn with inline SVG paths, circles and rectangles; no linked images or imported icon library. |
| BugZoo favicon and brand mark                     | [`favicon.svg`](../public/favicon.svg)                                 | A local SVG robot face drawn with paths and rectangles.                                                                             |
| Fraction diagrams                                 | [`FractionVisual.tsx`](../src/features/fractionFox/FractionVisual.tsx) | Product code renders the exact fraction values using HTML/CSS.                                                                      |
| Number line                                       | [`NumberLine.tsx`](../src/features/minusMole/NumberLine.tsx)           | Inline SVG driven by the integer subtraction model.                                                                                 |
| Probability lab                                   | [`ProbabilityLab.tsx`](../src/features/chanceCrow/ProbabilityLab.tsx)  | Product code renders the bag, physical ball identifiers and ordered sample space; SVG/CSS, without external artwork.                |

The [social / README brand card SVG](../public/brand-card.svg) reuses the local robot mark and brand palette in a project SVG composition. Its [PNG rendering](../public/brand-card.png) is generated from that editable vector in the browser, without external artwork.

The four portraits are documented in their source as original decorative robot illustrations. The source inspection found no external image references, third-party illustration package, downloaded stock art or embedded font files. Text uses fonts already available on the visitor's device, including Segoe UI, PingFang TC, Microsoft JhengHei and Georgia; BugZoo does not redistribute those fonts or request a font service.

四個角色與品牌圖示由專案內的 SVG 程式碼繪製，教學圖形由實際數學資料產生。公開前檢查未發現引用外部圖庫或第三方圖片；版權擁有者仍須由維護者確認，不能由檔案位置或原創註解推定法律上的權利歸屬。

## Screenshots / 截圖

Only deliberately selected product screenshots belong in published documentation. Create them in a fresh browser context using synthetic examples, and review them for personal progress, names, browser chrome, file paths and other identifying information before adding them.

Historical verification images, downloaded learning passports, Playwright traces and diagnostic records remain local. `.qa/`, `test-results/` and `playwright-report/` are ignored by Git and must not be copied wholesale into the repository. A product screenshot showing a seeded example is not evidence of a real student's achievement.

The selected screenshots below were captured from a local production preview on 2026-10-14 in separate fresh Chrome contexts. They show synthetic examples, no browser chrome, personal learning records, downloaded passports or identifying file paths. Both PNGs were visually inspected before inclusion.

| Screenshot                                  | Visible synthetic example                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`minus-mole.png`](images/minus-mole.png)   | The real experiment `5 − (−3)` compares the robot's wrong answer `2` and leftward path with the correct answer `8` and rightward path.                   |
| [`chance-crow.png`](images/chance-crow.png) | A fresh bag with three red and two blue uniquely identified balls, exact target probability `3/10`, and all 20 possible ordered outcomes before drawing. |

## Dependencies / 套件

Third-party runtime and development packages are listed in [`package.json`](../package.json) and resolved by [`pnpm-lock.yaml`](../pnpm-lock.yaml). Their licenses remain their respective authors' licenses. `node_modules/` and generated build output are excluded from source control; this asset inventory does not replace a dependency license review.

The installed direct-package manifests inspected on 2026-10-14 declare MIT licenses, except `@playwright/test` and `typescript`, which declare Apache-2.0. This records direct-package metadata only; it does not certify all transitive dependencies or remove their notice requirements.

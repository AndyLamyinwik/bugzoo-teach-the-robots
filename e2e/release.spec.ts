import { test, expect } from './fixtures';

test('static base assets, bilingual route titles, refresh, and invalid hash fallback work', async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error('A deployed application URL is required.');
  await page.goto('./');
  await expect(page).toHaveTitle('BugZoo — Teach the Wrong Robots');
  const base = new URL(baseURL);
  const logo = page.getByRole('banner').locator('img');
  await expect(logo).toHaveAttribute('src', `${base.pathname}favicon.svg`);
  await expect
    .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  const assetURLs = await page.evaluate(() => [
    document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href,
    document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content,
  ]);
  for (const [index, assetURL] of assetURLs.entries()) {
    if (!assetURL) throw new Error('The favicon and Open Graph image must be declared.');
    const asset = new URL(assetURL, baseURL);
    expect(asset.origin).toBe(base.origin);
    expect(asset.pathname.startsWith(base.pathname)).toBe(true);
    const result = await page.request.get(asset.href);
    expect(result.ok()).toBe(true);
    if (index === 0) {
      expect(result.headers()['content-type']).toContain('image/svg+xml');
      expect(await result.text()).toContain('<svg');
    } else {
      expect(result.headers()['content-type']).toContain('image/png');
      const image = await result.body();
      expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(image.readUInt32BE(16)).toBe(1200);
      expect(image.readUInt32BE(20)).toBe(630);
    }
  }

  const routes = [
    [
      'fractionfox',
      'FractionFox — Fraction Addition | BugZoo',
      'FractionFox 分數狐狸 | BugZoo',
    ],
    [
      'discountpanda',
      'DiscountPanda — Successive Discounts | BugZoo',
      'DiscountPanda 折扣熊貓 | BugZoo',
    ],
    [
      'minusmole',
      'MinusMole — Integer Subtraction | BugZoo',
      'MinusMole 負數鼴鼠 | BugZoo',
    ],
    [
      'chancecrow',
      'ChanceCrow — Probability Without Replacement | BugZoo',
      'ChanceCrow 機率烏鴉 | BugZoo',
    ],
    ['progress', 'Learning Progress | BugZoo', '學習進度 | BugZoo'],
    ['passport', 'Learning Passport | BugZoo', '學習護照 | BugZoo'],
  ] as const;
  for (const [route, englishTitle, chineseTitle] of routes) {
    await page.goto(`./#${route}`);
    await expect(page).toHaveTitle(englishTitle);
    await expect(page.locator('main')).toBeVisible();
    await page.reload();
    await expect(page).toHaveTitle(englishTitle);
    await expect(page.locator('main')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(base.pathname);
    await page
      .getByRole('combobox', { name: 'Interface language', exact: true })
      .selectOption('zh-TW');
    await expect(page).toHaveTitle(chineseTitle);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      'content',
      'zh_TW',
    );
    await page
      .getByRole('combobox', { name: '介面語言', exact: true })
      .selectOption('en');
  }
  await page.goto('./#not-a-lesson');
  await expect(page).toHaveTitle('BugZoo — Teach the Wrong Robots');
  await expect(
    page.getByRole('heading', { name: /This time, you get/, level: 1 }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: /This time, you get/, level: 1 }),
  ).toBeVisible();
});

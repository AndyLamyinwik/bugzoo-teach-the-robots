import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import {
  beginExperiment,
  fillCrow,
  fillFraction,
  lessons,
  openLesson,
} from './lessonHelpers';

const chineseHeadings: Readonly<Record<string, string>> = {
  fractionfox: 'FractionFox 的分數教室',
  discountpanda: 'DiscountPanda 的折扣商店',
  minusmole: 'MinusMole 的數線隧道',
  chancecrow: 'ChanceCrow 的球袋實驗室',
};

test('all seven main pages fit five target widths, including long English text', async ({
  page,
}) => {
  const pages = [
    { hash: '', heading: /This time, you get/, chinese: /^這次，換你/ },
    ...Object.entries(lessons).map(([id, lesson]) => ({
      hash: id,
      heading: lesson.heading,
      chinese: chineseHeadings[id],
    })),
    { hash: 'progress', heading: 'Learning dashboard', chinese: '學習總覽' },
    { hash: 'passport', heading: 'Learning passport', chinese: '學習護照' },
  ];
  for (const width of [320, 375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const entry of pages) {
      await page.goto(`./#${entry.hash}`);
      await expect(
        page.getByRole('heading', { name: entry.heading, level: 1 }),
      ).toBeVisible();
      const size = await page.evaluate(() => ({
        viewport: innerWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(size.viewport).toBe(width);
      expect(
        size.content,
        `${entry.hash || 'home'} overflows at ${width}px`,
      ).toBeLessThanOrEqual(width + 1);
      if (entry.hash === '') {
        const action = page.getByRole('link', { name: 'Teach FractionFox', exact: true });
        await expect(action).toHaveCSS('background-color', 'rgb(24, 60, 53)');
        expect(
          await action.evaluate((element) => element.getBoundingClientRect().height),
        ).toBeGreaterThanOrEqual(44);
      }
      if (width === 375) {
        await page
          .getByRole('combobox', { name: 'Interface language', exact: true })
          .selectOption('zh-TW');
        if (entry.chinese === undefined) throw new Error('Missing Chinese page heading');
        await expect(
          page.getByRole('heading', { name: entry.chinese, level: 1 }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width + 1);
        await page
          .getByRole('combobox', { name: '介面語言', exact: true })
          .selectOption('en');
      }
    }
  }
});

test('keyboard completes all five FractionFox steps, associates errors, and keeps modal focus inside', async ({
  page,
}) => {
  await openLesson(page, 'fractionfox');
  await page
    .getByRole('button', { name: 'I have observed; make a hypothesis' })
    .press('Enter');
  await page.getByRole('radio', { name: /^Misconception A:/ }).press('Space');
  await page
    .getByRole('button', { name: 'Experiment with this hypothesis' })
    .press('Enter');
  const denominator = page.getByRole('textbox', {
    name: 'First fraction denominator',
    exact: true,
  });
  await denominator.fill('0');
  await page.getByRole('button', { name: 'Test the fox’s answer' }).press('Enter');
  await expect(denominator).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByRole('textbox', { name: 'Second fraction denominator', exact: true }),
  ).not.toHaveAttribute('aria-invalid', 'true');
  const errorId = await page.getByRole('alert').getAttribute('id');
  expect(errorId).toBeTruthy();
  await expect(denominator).toHaveAttribute(
    'aria-describedby',
    new RegExp(`(^| )${errorId}( |$)`),
  );
  await denominator.fill('2');
  await expect(denominator).not.toHaveAttribute('aria-invalid', 'true');
  const restart = page.getByRole('button', { name: 'Restart lesson', exact: true });
  await restart.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Reset lesson' });
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  for (let index = 0; index < 4; index++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() =>
        document.querySelector('dialog[open]')?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('Shift+Tab');
    expect(
      await page.evaluate(() =>
        document.querySelector('dialog[open]')?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(restart).toBeFocused();
  await expect(page.getByRole('heading', { name: /^03 \/ / })).toBeVisible();

  await page.getByRole('button', { name: 'Test the fox’s answer' }).press('Enter');
  await page.getByRole('button', { name: 'Start teaching with examples' }).press('Enter');
  await expect(page.getByRole('heading', { name: /^04 \/ / })).toBeVisible();
  await fillFraction(page, 'First fraction', '1', '2');
  await fillFraction(page, 'Second fraction', '1', '3');
  await fillFraction(page, 'Teaching answer', '5', '6');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Submit a correct example' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByRole('region', { name: 'Candidate rules', exact: true })
      .getByText('Eliminated', { exact: true }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Start final verification' }).press('Enter');
  await expect(page.getByRole('heading', { name: /^05 \/ / })).toBeVisible();

  for (let index = 0; index < 3; index++) {
    await expect(
      page.getByLabel(`Completed ${index} / 3 questions`, { exact: true }),
    ).toBeVisible();
    const submit = page.getByRole('button', { name: 'Submit verification answer' });
    const form = page.locator('form').filter({ has: submit });
    const question = await form
      .getByRole('img', { name: /^What is / })
      .getAttribute('aria-label');
    const terms = /^What is ([−-]?\d+)\/(\d+) plus ([−-]?\d+)\/(\d+)\?$/.exec(
      question ?? '',
    );
    if (!terms)
      throw new Error(`Could not read the visible fraction question: ${question}`);
    const [a, b, c, d] = terms
      .slice(1)
      .map((value) => BigInt(value.replaceAll('−', '-')));
    if (a === undefined || b === undefined || c === undefined || d === undefined)
      throw new Error('The visible fraction question is incomplete');
    await fillFraction(page, 'Verification answer', String(a * d + c * b), String(b * d));
    await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await expect(
    page.getByRole('heading', { name: 'FractionFox graduates!', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('3 / 3', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'My progress', exact: true }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Learning dashboard', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await page
    .getByRole('combobox', { name: 'Interface language', exact: true })
    .press('Home');
  await expect(page.getByRole('combobox', { name: '介面語言', exact: true })).toHaveValue(
    'zh-TW',
  );
  await expect(
    page.getByRole('heading', { name: '學習總覽', exact: true }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: '介面語言', exact: true }).press('End');
  await expect(
    page.getByRole('combobox', { name: 'Interface language', exact: true }),
  ).toHaveValue('en');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Learning Passport', exact: true })
    .press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Learning passport', exact: true }),
  ).toBeVisible();
  const downloadReady = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export Markdown learning passport', exact: true })
    .press('Enter');
  const download = await downloadReady;
  const path = await download.path();
  if (path === null) throw new Error('The keyboard-exported passport has no local file');
  const markdown = await readFile(path, 'utf8');
  expect(markdown).toContain('- Completed lessons: 1 / 4');
  expect(markdown).toContain('- FractionFox: Common-unit explainer');
});

test('reduced motion preserves exact number-line results and draw counts during replay', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLesson(page, 'discountpanda');
  await beginExperiment(page);
  await page.getByRole('button', { name: 'Test the panda’s quote' }).click();
  const prices = page.getByRole('figure', {
    name: 'Correct price changes through sequential discounts',
  });
  await expect(prices).toContainText('80.00');
  await expect(prices).toContainText('72.00');
  await openLesson(page, 'minusmole');
  await beginExperiment(page);
  await page.getByRole('button', { name: 'Test the mole’s path' }).click();
  const correctLine = page.getByRole('figure', { name: /^Correct number-line path/ });
  await expect(correctLine).toHaveAttribute('data-start', '5');
  await expect(correctLine).toHaveAttribute('data-end', '8');
  await expect(correctLine).toHaveAttribute('data-animation', 'reduced');
  await expect(correctLine).toContainText('right 3 units');
  await openLesson(page, 'chancecrow');
  const lab = page.getByRole('region', {
    name: 'Observe the bag without replacement',
    exact: true,
  });
  await lab.getByRole('button', { name: /: draw the first ball$/ }).click();
  await lab.getByRole('button', { name: /: draw the second ball$/ }).click();
  await expect(lab).toContainText(/Completed\s*1\s*trials/);
  await lab.getByRole('button', { name: /: replay draw animation$/ }).click();
  await expect(lab).toContainText(/Completed\s*1\s*trials/);
  await expect(lab.getByLabel('Current ball counts remaining in the bag')).toContainText(
    'Total 3 balls',
  );
});

test('maximum sample space stays readable and scrolls locally without widening the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openLesson(page, 'chancecrow');
  await beginExperiment(page);
  await fillCrow(page, '6', '6', 'red', 'blue');
  const lab = page.getByRole('region', {
    name: 'Probability lab for the current draft',
    exact: true,
  });
  await expect(lab.getByRole('figure', { name: /12 × 11 = 132/ })).toBeVisible();
  const table = lab.getByRole('table', {
    name: 'Ordered sample space of two physical ball draws',
  });
  await expect(table.getByRole('cell')).toHaveCount(144);
  await expect(
    table.getByRole('cell', { name: /impossible: the same ball cannot be drawn again/ }),
  ).toHaveCount(12);
  await expect(
    table.getByRole('columnheader', { name: 'R1', exact: true }),
  ).toBeVisible();
  const scrollRegion = lab.getByRole('region', {
    name: 'Ordered sample space of two physical ball draws',
    exact: true,
  });
  await expect(scrollRegion).toHaveAttribute('tabindex', '0');
  await scrollRegion.focus();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);
});

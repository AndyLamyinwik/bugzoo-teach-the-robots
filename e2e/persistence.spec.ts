import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { completeLesson, teachLesson, type LessonId } from './lessonHelpers';

const lessons = [
  { id: 'fractionfox', name: 'FractionFox' },
  { id: 'discountpanda', name: 'DiscountPanda' },
  { id: 'minusmole', name: 'MinusMole' },
  { id: 'chancecrow', name: 'ChanceCrow' },
] as const;

function lessonCard(page: Page, name: string): Locator {
  return page.getByRole('article').filter({
    has: page.getByRole('heading', { name, exact: true }),
  });
}

function statistic(container: Page | Locator, label: string): Locator {
  return container
    .getByRole('term')
    .filter({ hasText: label })
    .locator('..')
    .getByRole('definition');
}

async function savedRecord(page: Page, lessonId: LessonId): Promise<string> {
  const record = await page.evaluate(
    (id) => localStorage.getItem(`bugzoo.progress.${id}`),
    lessonId,
  );
  expect(record).not.toBeNull();
  if (record === null) throw new Error(`Missing saved record for ${lessonId}`);
  return record;
}

async function dashboard(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'My progress' }).click();
  await expect(
    page.getByRole('heading', { name: 'Learning dashboard', exact: true }),
  ).toBeVisible();
}

test('reload restores accepted teaching evidence without awarding an early completion', async ({
  page,
}) => {
  await teachLesson(page, 'fractionfox');
  const before = await savedRecord(page, 'fractionfox');

  await page.reload();
  await expect(
    page.getByRole('heading', { name: '04 / Teach with correct examples', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('View teaching history (1 valid examples)', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start final verification' }),
  ).toBeEnabled();
  expect(await savedRecord(page, 'fractionfox')).toBe(before);

  await dashboard(page);
  const fox = lessonCard(page, 'FractionFox');
  await expect(fox.getByText('In progress', { exact: true })).toBeVisible();
  await expect(statistic(fox, 'Effective counterexamples')).toHaveText('1');
  await expect(statistic(fox, 'Unseen-question verification')).toHaveText('0 / 3');
  await expect(statistic(page, 'Completed lessons')).toHaveText('0 / 4');
});

test('closing a page and reopening it in the same browser retains valid progress', async ({
  page,
  context,
}) => {
  await teachLesson(page, 'discountpanda');
  const before = await savedRecord(page, 'discountpanda');
  await page.close();

  const reopened = await context.newPage();
  await reopened.goto('./#discountpanda');
  await expect(
    reopened.getByRole('heading', {
      name: '04 / Teach with correct prices',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    reopened.getByRole('button', { name: 'Start final verification' }),
  ).toBeEnabled();
  expect(await savedRecord(reopened, 'discountpanda')).toBe(before);
  await dashboard(reopened);
  await expect(
    statistic(lessonCard(reopened, 'DiscountPanda'), 'Effective counterexamples'),
  ).toHaveText('1');
  await expect(
    lessonCard(reopened, 'FractionFox').getByText('Not started', { exact: true }),
  ).toBeVisible();
});

test('a genuinely completed lesson survives reload with all three verification answers', async ({
  page,
}) => {
  await completeLesson(page, 'fractionfox');
  const before = await savedRecord(page, 'fractionfox');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'FractionFox graduates!', exact: true }),
  ).toBeVisible();
  expect(await savedRecord(page, 'fractionfox')).toBe(before);

  await dashboard(page);
  const fox = lessonCard(page, 'FractionFox');
  await expect(
    fox.getByRole('link', { name: 'View results — FractionFox', exact: true }),
  ).toBeVisible();
  await expect(statistic(fox, 'Unseen-question verification')).toHaveText('3 / 3');
  await expect(statistic(page, 'Completed lessons')).toHaveText('1 / 4');
  await expect(statistic(page, 'Lessons verified on unseen questions')).toHaveText(
    '1 / 4',
  );
});

test('the four lessons stay independent and clearing one preserves the other three records', async ({
  page,
}) => {
  const records = new Map<LessonId, string>();
  for (const lesson of lessons) {
    await teachLesson(page, lesson.id);
    records.set(lesson.id, await savedRecord(page, lesson.id));
  }
  await dashboard(page);
  await expect(statistic(page, 'Lessons in progress')).toHaveText('4');
  for (const lesson of lessons) {
    await expect(
      statistic(lessonCard(page, lesson.name), 'Effective counterexamples'),
    ).toHaveText('1');
  }

  await page
    .getByRole('button', { name: 'Clear lesson progress — MinusMole', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Clear lesson progress', exact: true });
  await expect(dialog).toContainText(
    'Other lessons and your language preference will be kept.',
  );
  await dialog
    .getByRole('button', { name: 'Clear lesson progress', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    lessonCard(page, 'MinusMole').getByText('Not started', { exact: true }),
  ).toBeVisible();
  await expect(
    statistic(lessonCard(page, 'MinusMole'), 'Effective counterexamples'),
  ).toHaveText('0');
  await expect(statistic(page, 'Lessons in progress')).toHaveText('3');
  expect(
    await page.evaluate(() => localStorage.getItem('bugzoo.progress.minusmole')),
  ).toBeNull();

  await page.reload();
  for (const lesson of lessons.filter((lesson) => lesson.id !== 'minusmole')) {
    expect(await savedRecord(page, lesson.id)).toBe(records.get(lesson.id));
    await expect(
      lessonCard(page, lesson.name).getByText('In progress', { exact: true }),
    ).toBeVisible();
    await expect(
      statistic(lessonCard(page, lesson.name), 'Effective counterexamples'),
    ).toHaveText('1');
  }
});

test('all-progress clearing requires confirmation and keeps the selected language', async ({
  page,
}) => {
  await teachLesson(page, 'fractionfox');
  await teachLesson(page, 'discountpanda');
  const foxBefore = await savedRecord(page, 'fractionfox');
  const pandaBefore = await savedRecord(page, 'discountpanda');
  await page.evaluate(() => localStorage.setItem('bugzoo.e2e.unrelated', 'keep me'));
  await dashboard(page);
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-TW');

  const clear = page.getByRole('button', { name: '清除所有學習進度', exact: true });
  await clear.click();
  let dialog = page.getByRole('dialog', { name: '清除所有學習進度', exact: true });
  await expect(dialog).toContainText('語言偏好會保留');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await savedRecord(page, 'fractionfox')).toBe(foxBefore);
  expect(await savedRecord(page, 'discountpanda')).toBe(pandaBefore);
  await expect(statistic(page, '進行中課程')).toHaveText('2');

  await clear.click();
  dialog = page.getByRole('dialog', { name: '清除所有學習進度', exact: true });
  await dialog.getByRole('button', { name: '清除所有學習進度', exact: true }).click();
  await expect(
    page.getByText('已清除所有課程的學習進度。', { exact: true }),
  ).toBeVisible();
  await expect(statistic(page, '進行中課程')).toHaveText('0');
  await expect(statistic(page, '已完成課程')).toHaveText('0 / 4');
  for (const lesson of lessons) {
    await expect(
      lessonCard(page, lesson.name).getByText('尚未開始', { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (id) => localStorage.getItem(`bugzoo.progress.${id}`),
        lesson.id,
      ),
    ).toBeNull();
  }
  expect(await page.evaluate(() => localStorage.getItem('bugzoo.locale.v1'))).toBe(
    'zh-TW',
  );
  expect(await page.evaluate(() => localStorage.getItem('bugzoo.e2e.unrelated'))).toBe(
    'keep me',
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '學習總覽', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: '介面語言' })).toHaveValue('zh-TW');
  await expect(statistic(page, '通過未見題驗證')).toHaveText('0 / 4');
});

test('damaged JSON and unsupported lesson versions stay isolated and never earn achievements', async ({
  page,
}) => {
  await teachLesson(page, 'fractionfox');
  await teachLesson(page, 'discountpanda');
  await teachLesson(page, 'minusmole');
  const moleBefore = await savedRecord(page, 'minusmole');
  await dashboard(page);
  const unsupported = await page.evaluate(() => {
    const key = 'bugzoo.progress.fractionfox';
    const text = localStorage.getItem(key);
    if (text === null) throw new Error('Expected a real FractionFox record');
    const record: unknown = JSON.parse(text);
    if (record === null || typeof record !== 'object' || Array.isArray(record))
      throw new Error('Expected an object record');
    const next = JSON.stringify({ ...record, lessonVersion: 999 });
    localStorage.setItem(key, next);
    localStorage.setItem('bugzoo.progress.discountpanda', '{"stage":"complete",broken');
    return next;
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Learning dashboard', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Some saved data could not be safely restored/),
  ).toBeVisible();
  await expect(
    page.getByText(/Some saved data uses an unsupported version/),
  ).toBeVisible();
  for (const name of ['FractionFox', 'DiscountPanda']) {
    const card = lessonCard(page, name);
    await expect(card.getByText('Not started', { exact: true })).toBeVisible();
    await expect(statistic(card, 'Effective counterexamples')).toHaveText('0');
    await expect(statistic(card, 'Unseen-question verification')).toHaveText('0 / 3');
  }
  await expect(
    statistic(lessonCard(page, 'MinusMole'), 'Effective counterexamples'),
  ).toHaveText('1');
  await expect(statistic(page, 'Lessons in progress')).toHaveText('1');
  await expect(statistic(page, 'Completed lessons')).toHaveText('0 / 4');
  expect(await savedRecord(page, 'minusmole')).toBe(moleBefore);
  expect(await savedRecord(page, 'fractionfox')).toBe(unsupported);
  expect(await savedRecord(page, 'discountpanda')).toBe('{"stage":"complete",broken');

  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Learning Passport' })
    .click();
  await expect(
    page.getByText('Complete a lesson to earn its achievement here.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Earned achievements' }).getByRole('listitem'),
  ).toHaveCount(0);

  await page
    .getByRole('combobox', { name: 'Choose a lesson' })
    .selectOption('fractionfox');
  await page.getByRole('button', { name: 'I have observed; make a hypothesis' }).click();
  await expect(
    page.getByRole('heading', { name: '02 / Make a hypothesis', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/The latest progress is available in this page only/),
  ).toBeVisible();
  expect(await savedRecord(page, 'fractionfox')).toBe(unsupported);
  expect(await savedRecord(page, 'minusmole')).toBe(moleBefore);

  await dashboard(page);
  await page
    .getByRole('button', { name: 'Clear lesson progress — FractionFox', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Clear lesson progress', exact: true })
    .getByRole('button', { name: 'Clear lesson progress', exact: true })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem('bugzoo.progress.fractionfox')),
  ).toBeNull();
  await page
    .getByRole('combobox', { name: 'Choose a lesson' })
    .selectOption('fractionfox');
  await page.getByRole('button', { name: 'I have observed; make a hypothesis' }).click();
  await expect(
    page.getByRole('heading', { name: '02 / Make a hypothesis', exact: true }),
  ).toBeVisible();
  expect(await savedRecord(page, 'fractionfox')).not.toBe(unsupported);
  expect(await savedRecord(page, 'minusmole')).toBe(moleBefore);
});

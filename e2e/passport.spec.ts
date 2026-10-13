import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { finishVerification, teachLesson } from './lessonHelpers';

async function downloadMarkdown(page: Page, buttonName: string): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^BugZoo-learning-passport-\d{4}-\d{2}-\d{2}\.md$/,
  );
  const path = await download.path();
  if (path === null) throw new Error('The learning passport download has no local file');
  return readFile(path, 'utf8');
}

test('language switches translate the lesson and errors while preserving accepted evidence', async ({
  page,
}) => {
  await teachLesson(page, 'fractionfox');
  const before = await page.evaluate(() =>
    localStorage.getItem('bugzoo.progress.fractionfox'),
  );
  expect(before).not.toBeNull();
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-TW');
  await expect(
    page.getByRole('heading', { name: '04 / 用正確示例教牠', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('查看教學記錄（1 個有效示例）', { exact: true }),
  ).toBeVisible();
  await page.getByLabel(/教學答案.*分母/).fill('0');
  await page.getByRole('button', { name: '提交正確示例', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('分母');

  await page.getByRole('combobox', { name: '介面語言' }).selectOption('en');
  await expect(
    page.getByRole('heading', { name: '04 / Teach with correct examples', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('denominator');
  expect(
    await page.evaluate(() => localStorage.getItem('bugzoo.progress.fractionfox')),
  ).toBe(before);
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-TW');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '介面語言' })).toHaveValue('zh-TW');
  await expect(
    page.getByRole('heading', { name: 'FractionFox 的分數教室', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('查看教學記錄（1 個有效示例）', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '開始最終驗證', exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => localStorage.getItem('bugzoo.progress.fractionfox')),
  ).toBe(before);
});

test('passport and downloaded Markdown report real partial progress and only earned achievements in both languages', async ({
  page,
}) => {
  await teachLesson(page, 'fractionfox');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Learning Passport' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Learning passport', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Complete a lesson to earn its achievement here.', { exact: true }),
  ).toBeVisible();
  const partialFox = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'FractionFox', exact: true }),
  });
  await expect(partialFox.getByText('In progress', { exact: true })).toBeVisible();
  await expect(partialFox).toContainText('Verification not started (0 / 3)');
  await expect(partialFox).toContainText('Effective counterexamples: 1');
  const partialMarkdown = await downloadMarkdown(
    page,
    'Export Markdown learning passport',
  );
  expect(partialMarkdown).toContain('- Completed lessons: 0 / 4');
  expect(partialMarkdown).toContain('- Effective counterexamples: 1');
  expect(partialMarkdown).toContain('Complete a lesson to earn its achievement here.');
  expect(partialMarkdown).not.toContain('FractionFox: Common-unit explainer');

  await page
    .getByRole('combobox', { name: 'Choose a lesson' })
    .selectOption('fractionfox');
  await expect(
    page.getByRole('heading', { name: '04 / Teach with correct examples', exact: true }),
  ).toBeVisible();
  await finishVerification(page, 'fractionfox');
  await teachLesson(page, 'discountpanda');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Learning Passport' })
    .click();
  const achievements = page.getByRole('region', { name: 'Earned achievements' });
  await expect(achievements.getByRole('listitem')).toHaveCount(1);
  await expect(achievements).toContainText('Common-unit explainer');
  await expect(achievements).toContainText('FractionFox');
  await expect(achievements).not.toContainText('Discount-base tracker');
  const completedFox = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'FractionFox', exact: true }),
  });
  const partialPanda = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'DiscountPanda', exact: true }),
  });
  await expect(completedFox).toContainText('Student and robot both passed (3 / 3)');
  await expect(partialPanda).toContainText('Verification not started (0 / 3)');
  await expect(partialPanda.getByText('In progress', { exact: true })).toBeVisible();

  const english = await downloadMarkdown(page, 'Export Markdown learning passport');
  expect(english).toContain('# BugZoo Learning Passport');
  expect(english).toContain('- Completed lessons: 1 / 4');
  expect(english).toContain('- Lessons in progress: 1');
  expect(english).toContain('- Effective counterexamples: 2');
  expect(english).toContain('- Lessons verified on unseen questions: 1 / 4');
  expect(english).toContain('- FractionFox: Common-unit explainer');
  expect(english).not.toContain('DiscountPanda: Discount-base tracker');
  expect(english).not.toContain('MinusMole: Number-line navigator');
  expect(english).not.toContain('ChanceCrow: Conditional-probability observer');
  expect(english).not.toMatch(/[\u3400-\u9fff]/);
  const englishPanda = english.match(/### DiscountPanda[\s\S]*?(?=\n### MinusMole)/)?.[0];
  expect(englishPanda).toContain('- Status: In progress');
  expect(englishPanda).toContain('Verification not started (0 / 3)');
  for (const name of ['FractionFox', 'DiscountPanda', 'MinusMole', 'ChanceCrow'])
    expect(english).toContain(`### ${name}`);

  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-TW');
  await expect(
    page.getByRole('heading', { name: '學習護照', exact: true }),
  ).toBeVisible();
  const chineseAchievements = page.getByRole('region', { name: '已獲得的成就' });
  await expect(chineseAchievements.getByRole('listitem')).toHaveCount(1);
  await expect(chineseAchievements).toContainText('相同單位的解說員');
  await expect(partialPanda.getByText('進行中', { exact: true })).toBeVisible();
  const chinese = await downloadMarkdown(page, '匯出 Markdown 學習護照');
  expect(chinese).toContain('# BugZoo 學習護照');
  expect(chinese).toContain('- 已完成課程: 1 / 4');
  expect(chinese).toContain('- 進行中課程: 1');
  expect(chinese).toContain('- 有效反例: 2');
  expect(chinese).toContain('- 通過未見題驗證: 1 / 4');
  expect(chinese).toContain('學生與機器人均通過 (3 / 3)');
  expect(chinese).toContain('- FractionFox: 相同單位的解說員');
  expect(chinese).not.toContain('DiscountPanda: 折扣基準的追蹤員');
  expect(chinese).not.toContain('Common-unit explainer');
  const chinesePanda = chinese.match(/### DiscountPanda[\s\S]*?(?=\n### MinusMole)/)?.[0];
  expect(chinesePanda).toContain('- 狀態: 進行中');
  expect(chinesePanda).toContain('尚未開始驗證 (0 / 3)');
});

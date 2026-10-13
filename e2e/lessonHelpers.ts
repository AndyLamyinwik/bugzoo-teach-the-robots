import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

export type LessonId = 'fractionfox' | 'discountpanda' | 'minusmole' | 'chancecrow';

export const lessons = {
  fractionfox: {
    name: 'FractionFox',
    heading: 'FractionFox’s fraction classroom',
    experiment: 'Test the fox’s answer',
    complete: 'FractionFox graduates!',
  },
  discountpanda: {
    name: 'DiscountPanda',
    heading: 'DiscountPanda’s discount shop',
    experiment: 'Test the panda’s quote',
    complete: 'DiscountPanda graduates!',
  },
  minusmole: {
    name: 'MinusMole',
    heading: 'MinusMole’s number-line tunnel',
    experiment: 'Test the mole’s path',
    complete: 'MinusMole found the right direction!',
  },
  chancecrow: {
    name: 'ChanceCrow',
    heading: 'ChanceCrow’s probability lab',
    experiment: 'Test the crow’s answer',
    complete: 'ChanceCrow understands two draws!',
  },
} as const;

/** Enter through the real home card. Existing saved progress is left intact. */
export async function openLesson(page: Page, id: LessonId) {
  await page.goto('./');
  await page
    .getByRole('combobox', { name: /^(介面語言|Interface language)$/ })
    .selectOption('en');
  await page
    .getByRole('article', { name: lessons[id].name, exact: true })
    .getByRole('link')
    .click();
  await expect(page.getByRole('heading', { name: lessons[id].heading })).toBeVisible();
}

export function candidates(page: Page): Locator {
  return page.getByRole('region', { name: 'Candidate rules', exact: true });
}

export async function beginExperiment(page: Page) {
  await expect(page.getByRole('heading', { name: /^01 \/ / })).toBeVisible();
  await page.getByRole('button', { name: 'I have observed; make a hypothesis' }).click();
  await expect(
    page.getByRole('heading', { name: '02 / Make a hypothesis' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: /^Misconception A:/ }).check();
  await page.getByRole('button', { name: 'Experiment with this hypothesis' }).click();
  await expect(page.getByRole('heading', { name: /^03 \/ / })).toBeVisible();
}

export async function startTeaching(page: Page) {
  await page.getByRole('button', { name: 'Start teaching with examples' }).click();
  await expect(page.getByRole('heading', { name: /^04 \/ / })).toBeVisible();
}

export async function reachTeaching(page: Page, id: LessonId) {
  await openLesson(page, id);
  await beginExperiment(page);
  await page.getByRole('button', { name: lessons[id].experiment, exact: true }).click();
  await startTeaching(page);
}

export async function fillFraction(
  page: Page,
  label: 'First fraction' | 'Second fraction' | 'Teaching answer' | 'Verification answer',
  numerator: string,
  denominator: string,
) {
  await page
    .getByRole('textbox', { name: `${label} numerator`, exact: true })
    .fill(numerator);
  await page
    .getByRole('textbox', { name: `${label} denominator`, exact: true })
    .fill(denominator);
}

export async function fillPanda(
  page: Page,
  price: string,
  firstDiscount: string,
  secondDiscount: string,
) {
  await page.getByRole('textbox', { name: 'Original price', exact: true }).fill(price);
  await page
    .getByRole('textbox', { name: 'First discount percentage' })
    .fill(firstDiscount);
  await page
    .getByRole('textbox', { name: 'Second discount percentage' })
    .fill(secondDiscount);
}

export async function fillMole(page: Page, start: string, subtrahend: string) {
  await page.getByRole('textbox', { name: 'Minuend a (starting point)' }).fill(start);
  await page.getByRole('textbox', { name: 'Subtrahend b', exact: true }).fill(subtrahend);
}

export async function fillCrow(
  page: Page,
  red: string,
  blue: string,
  first: 'red' | 'blue',
  second: 'red' | 'blue',
) {
  await page.getByRole('textbox', { name: 'Number of red balls' }).fill(red);
  await page.getByRole('textbox', { name: 'Number of blue balls' }).fill(blue);
  await page.getByRole('combobox', { name: 'First target color' }).selectOption(first);
  await page.getByRole('combobox', { name: 'Second target color' }).selectOption(second);
}

/** One genuine accepted counterexample, still in Teach and ready for verification. */
export async function teachLesson(page: Page, id: LessonId) {
  await reachTeaching(page, id);
  switch (id) {
    case 'fractionfox':
      await fillFraction(page, 'First fraction', '1', '2');
      await fillFraction(page, 'Second fraction', '1', '3');
      await fillFraction(page, 'Teaching answer', '5', '6');
      break;
    case 'discountpanda':
      await fillPanda(page, '100', '20', '10');
      await page
        .getByRole('textbox', { name: 'Teaching answer (currency units)' })
        .fill('72');
      break;
    case 'minusmole':
      await fillMole(page, '-5', '-3');
      await page
        .getByRole('textbox', { name: 'Teaching answer', exact: true })
        .fill('-2');
      break;
    case 'chancecrow':
      await fillCrow(page, '3', '2', 'red', 'blue');
      await fillFraction(page, 'Teaching answer', '3', '10');
      break;
  }
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(candidates(page).getByText('Eliminated', { exact: true })).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Start final verification' }),
  ).toBeEnabled();
}

function captures(text: string, pattern: RegExp): string[] {
  const result = pattern.exec(text);
  if (!result) throw new Error(`Could not read the visible question: ${text}`);
  return result.slice(1);
}

function integer(value: string | undefined): bigint {
  if (value === undefined) throw new Error('A visible question term is missing');
  return BigInt(value.replaceAll('−', '-'));
}

function hundredths(value: string | undefined): bigint {
  if (value === undefined) throw new Error('A visible decimal term is missing');
  const [whole, decimals = ''] = value.split('.');
  return BigInt(whole ?? '0') * 100n + BigInt(decimals.padEnd(2, '0'));
}

/** Solve only the current visible question, independently of the app's rule engine. */
export async function answerCurrentVerification(page: Page, id: LessonId) {
  const submit = page.getByRole('button', { name: 'Submit verification answer' });
  // Forms have no accessible name, so scope by their semantic submit button.
  const form = page.locator('form').filter({ has: submit });
  await expect(form).toBeVisible();
  const text = await form.innerText();
  switch (id) {
    case 'fractionfox': {
      const question = await form
        .getByRole('img', { name: /^What is / })
        .getAttribute('aria-label');
      const [a, b, c, d] = captures(
        question ?? '',
        /^What is ([−-]?\d+)\/(\d+) plus ([−-]?\d+)\/(\d+)\?$/,
      ).map(integer);
      if (a === undefined || b === undefined || c === undefined || d === undefined)
        throw new Error('Fraction question is incomplete');
      await fillFraction(
        page,
        'Verification answer',
        String(a * d + c * b),
        String(b * d),
      );
      break;
    }
    case 'discountpanda': {
      const [price, first, second] = captures(
        text,
        /Original price\s+(\d+(?:\.\d+)?)\s+currency units\s*First discount\s+(\d+(?:\.\d+)?)%\s*Second discount\s+(\d+(?:\.\d+)?)%/,
      ).map(hundredths);
      if (price === undefined || first === undefined || second === undefined)
        throw new Error('Discount question is incomplete');
      // All intermediate prices stay rational. Half-up rounding happens only at the end.
      const divisor = 10000n * 10000n;
      const cents =
        (price * (10000n - first) * (10000n - second) + divisor / 2n) / divisor;
      await page
        .getByRole('textbox', { name: 'Verification answer (currency units)' })
        .fill(`${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`);
      break;
    }
    case 'minusmole': {
      const [start, subtrahend] = captures(
        text,
        /([−-]?\d+)\s*−\s*\(?([−-]?\d+)\)?\s*=\s*\?/,
      ).map(integer);
      if (start === undefined || subtrahend === undefined)
        throw new Error('Subtraction question is incomplete');
      await page
        .getByRole('textbox', { name: 'Verification answer', exact: true })
        .fill(String(start - subtrahend));
      break;
    }
    case 'chancecrow': {
      const [redText, blueText, first, second] = captures(
        text,
        /Red balls\s+(\d+)\s+balls\s*Blue balls\s+(\d+)\s+balls\s*Target order:\s*(red|blue) ball → (red|blue) ball/,
      );
      const red = integer(redText);
      const blue = integer(blueText);
      const total = red + blue;
      const firstCount = first === 'red' ? red : blue;
      const secondCount = (second === 'red' ? red : blue) - (first === second ? 1n : 0n);
      await fillFraction(
        page,
        'Verification answer',
        String(firstCount === 0n ? 0n : firstCount * secondCount),
        String(total * (total - 1n)),
      );
      break;
    }
  }
  await submit.click();
}

export async function finishVerification(page: Page, id: LessonId) {
  await page.getByRole('button', { name: 'Start final verification' }).click();
  await expect(page.getByRole('heading', { name: /^05 \/ / })).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    await expect(
      page.getByLabel(`Completed ${index} / 3 questions`, { exact: true }),
    ).toBeVisible();
    await answerCurrentVerification(page, id);
    if (index < 2)
      await expect(
        page.getByLabel(`Completed ${index + 1} / 3 questions`, { exact: true }),
      ).toBeVisible();
  }
  await expect(
    page.getByRole('heading', { name: lessons[id].complete, exact: true }),
  ).toBeVisible();
  await expect(page.getByText('3 / 3', { exact: true })).toBeVisible();
}

export async function completeLesson(page: Page, id: LessonId) {
  await teachLesson(page, id);
  await finishVerification(page, id);
}

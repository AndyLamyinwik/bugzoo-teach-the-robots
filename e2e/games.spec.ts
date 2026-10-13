import { test, expect } from './fixtures';
import {
  beginExperiment,
  candidates,
  fillCrow,
  fillFraction,
  fillMole,
  fillPanda,
  finishVerification,
  openLesson,
  startTeaching,
} from './lessonHelpers';

test('FractionFox checks input and evidence, then passes all five steps', async ({
  page,
}) => {
  await openLesson(page, 'fractionfox');
  await expect(
    page.getByRole('img', {
      name: /The fox’s assignment.*1 over 2 plus 1 over 3 equals 2 over 5/,
    }),
  ).toBeVisible();
  await beginExperiment(page);
  await fillFraction(page, 'First fraction', '1', '0');
  await page.getByRole('button', { name: 'Test the fox’s answer' }).click();
  await expect(page.getByRole('alert')).toContainText('The denominator cannot be zero.');
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: 'Start teaching with examples' }),
  ).toBeDisabled();

  await fillFraction(page, 'First fraction', '1', '2');
  await page.getByRole('button', { name: 'Test the fox’s answer' }).click();
  await expect(
    page.getByRole('img', {
      name: '1 over 2 plus 1 over 3 equals 5 over 6',
      exact: true,
    }),
  ).toBeVisible();
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);
  await startTeaching(page);

  await fillFraction(page, 'Teaching answer', '2', '5');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(page.getByRole('alert')).toContainText('candidates have not changed');
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);
  await expect(page.getByText(/View teaching history/)).toHaveCount(0);

  await fillFraction(page, 'First fraction', '0', '2');
  await fillFraction(page, 'Second fraction', '0', '3');
  await fillFraction(page, 'Teaching answer', '0', '1');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(
    page.getByText(
      'No candidates were eliminated: these rules give the same answer here. Design a different example.',
    ),
  ).toBeVisible();
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: 'Start final verification' }),
  ).toBeDisabled();

  await fillFraction(page, 'First fraction', '1', '2');
  await fillFraction(page, 'Second fraction', '1', '2');
  await fillFraction(page, 'Teaching answer', '1', '1');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(2);
  await expect(
    candidates(page)
      .getByRole('listitem')
      .filter({ hasText: 'Misconception A: add both terms' })
      .getByText('Eliminated', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start final verification' }),
  ).toBeDisabled();

  await fillFraction(page, 'Second fraction', '1', '3');
  await fillFraction(page, 'Teaching answer', '10', '12');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(candidates(page).getByText('Eliminated', { exact: true })).toHaveCount(2);
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(1);
  await finishVerification(page, 'fractionfox');
  await expect(page.getByText(/student and fox passed verification/)).toHaveCount(3);
});

test('DiscountPanda uses sequential 20% and 10% discounts before real verification', async ({
  page,
}) => {
  await openLesson(page, 'discountpanda');
  await expect(page.getByText(/^70\.00\s*currency units$/)).toBeVisible();
  await beginExperiment(page);
  await fillPanda(page, '100', '20', '10');
  await page.getByRole('button', { name: 'Test the panda’s quote' }).click();
  const priceChanges = page.getByRole('figure', {
    name: 'Correct price changes through sequential discounts',
  });
  await expect(priceChanges).toContainText('80.00');
  await expect(priceChanges).toContainText('72.00');
  await expect(page.getByText(/^70\.00\s*currency units$/)).toBeVisible();
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);
  await startTeaching(page);

  await page
    .getByRole('textbox', { name: 'Teaching answer (currency units)' })
    .fill('70');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(page.getByRole('alert')).toContainText('candidates have not changed');
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);

  await fillPanda(page, '100', '20', '0');
  await page
    .getByRole('textbox', { name: 'Teaching answer (currency units)' })
    .fill('80.00');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Start final verification' }),
  ).toBeDisabled();
  await fillPanda(page, '100', '20', '10');
  await page
    .getByRole('textbox', { name: 'Teaching answer (currency units)' })
    .fill('72.00');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(candidates(page).getByText('Eliminated', { exact: true })).toHaveCount(2);
  await finishVerification(page, 'discountpanda');
  await expect(page.getByText(/student and panda passed verification/)).toHaveCount(3);
});

test('MinusMole exposes correct starts, endpoints and both subtraction directions', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openLesson(page, 'minusmole');
  await expect(
    page.getByRole('img', { name: 'The mole’s number-line reasoning', exact: true }),
  ).toHaveAccessibleDescription(/Start at 5 and finish at 2.*left 3 units/);
  await beginExperiment(page);
  await fillMole(page, '2', '-7');
  await page.getByRole('button', { name: 'Test the mole’s path' }).click();
  const correctLine = page.getByRole('img', {
    name: 'Correct number-line path',
    exact: true,
  });
  await expect(correctLine).toHaveAccessibleDescription(
    /Start at 2 and finish at 9.*move right 7 units/,
  );
  await page
    .getByRole('button', {
      name: 'Correct number-line path: replay animation',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Correct number-line path: skip animation',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('figure', { name: /^Correct number-line path/ }),
  ).toContainText('Number-line animation complete.');

  await fillMole(page, '2', '7');
  await page.getByRole('button', { name: 'Test the mole’s path' }).click();
  await expect(correctLine).toHaveAccessibleDescription(
    /Start at 2 and finish at -5.*move left 7 units/,
  );
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);
  await fillMole(page, '2', '1e1');
  await page.getByRole('button', { name: 'Test the mole’s path' }).click();
  await expect(page.getByRole('alert')).toContainText(/integer|scientific notation/i);
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);
  await startTeaching(page);
  await fillMole(page, '-5', '-3');
  await page.getByRole('textbox', { name: 'Teaching answer', exact: true }).fill('-2');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(
    page.getByRole('img', {
      name: 'Correct number line for the valid example',
      exact: true,
    }),
  ).toHaveAccessibleDescription(/Start at -5 and finish at -2.*move right 3 units/);
  await expect(candidates(page).getByText('Eliminated', { exact: true })).toHaveCount(2);
  await finishVerification(page, 'minusmole');
  await expect(page.getByText(/student and mole passed verification/)).toHaveCount(3);
});

test('ChanceCrow preserves no-replacement invariants and verifies three unseen situations', async ({
  page,
}) => {
  await openLesson(page, 'chancecrow');
  const lab = page.getByRole('region', {
    name: 'Observe the bag without replacement',
    exact: true,
  });
  const counts = lab.getByLabel('Current ball counts remaining in the bag', {
    exact: true,
  });
  const table = lab.getByRole('table', {
    name: 'Ordered sample space of two physical ball draws',
  });
  await expect(counts).toContainText('Red 3');
  await expect(counts).toContainText('Blue 2');
  await expect(counts).toContainText('Total 5 balls');
  await expect(table.getByRole('cell')).toHaveCount(25);
  await expect(
    table.getByRole('cell', { name: /impossible: the same ball cannot be drawn again/ }),
  ).toHaveCount(5);
  await expect(
    lab.getByRole('figure', {
      name: /5 × 4 =\s*20\s*equally likely outcomes; the target event has\s*6\s*outcomes\./,
    }),
  ).toBeVisible();
  await lab.getByRole('button', { name: /: draw the first ball$/ }).click();
  const firstStatus = lab.getByRole('status').filter({ hasText: /^First ball:/ });
  await expect(firstStatus).toBeVisible();
  const firstId = (await firstStatus.innerText()).match(/\b([RB]\d+)\b/)?.[1];
  if (!firstId) throw new Error('The first physical ball ID is missing');
  await expect(counts).toContainText(`Red ${firstId.startsWith('R') ? 2 : 3}`);
  await expect(counts).toContainText(`Blue ${firstId.startsWith('B') ? 1 : 2}`);
  await expect(counts).toContainText('Total 4 balls');
  await expect(lab.getByText('No complete trials yet', { exact: true })).toBeVisible();
  await expect(
    lab.getByRole('status').filter({ hasText: /^With first ball/ }),
  ).toContainText('4 possible second balls');

  await lab.getByRole('button', { name: /: draw the second ball$/ }).click();
  const result = lab.getByRole('status').filter({ hasText: /^Observed result:/ });
  await expect(result).toBeVisible();
  const resultText = await result.innerText();
  const ids = resultText.match(/\b[RB]\d+\b/g);
  expect(ids).toHaveLength(2);
  expect(ids?.[0]).toBe(firstId);
  expect(ids?.[1]).not.toBe(firstId);
  await expect(counts).toContainText('Total 3 balls');
  await expect(
    lab.getByText(/Completed\s*1\s*trials; target matches\s*\d\s*times\./),
  ).toBeVisible();
  await lab.getByRole('button', { name: /: replay draw animation$/ }).click();
  await expect(result).toHaveText(resultText);
  await expect(
    lab.getByText(/Completed\s*1\s*trials; target matches\s*\d\s*times\./),
  ).toBeVisible();
  await lab.getByRole('button', { name: /: new trial \(restore bag\)$/ }).click();
  await expect(counts).toContainText('Total 5 balls');
  await expect(
    lab.getByText(/Completed\s*1\s*trials; target matches\s*\d\s*times\./),
  ).toBeVisible();
  await lab.getByRole('button', { name: /: reset experiment and counts$/ }).click();
  await expect(lab.getByText('No complete trials yet', { exact: true })).toBeVisible();
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(3);

  await beginExperiment(page);
  await fillCrow(page, '1', '1', 'red', 'blue');
  const preview = page.getByRole('region', {
    name: 'Probability lab for the current draft',
    exact: true,
  });
  await expect(
    preview.getByLabel('Current ball counts remaining in the bag'),
  ).toContainText('Total 2 balls');
  await expect(
    preview.getByRole('figure', {
      name: /2 × 1 =\s*2\s*equally likely outcomes; the target event has\s*1\s*outcomes\./,
    }),
  ).toBeVisible();
  await fillCrow(page, '0', '2', 'red', 'blue');
  await expect(preview.getByText('Undefined', { exact: true })).toBeVisible();
  await expect(
    preview.getByRole('figure', {
      name: /2 × 1 =\s*2\s*equally likely outcomes; the target event has\s*0\s*outcomes\./,
    }),
  ).toBeVisible();
  await fillCrow(page, '3', '2', 'red', 'blue');
  await page.getByRole('button', { name: 'Test the crow’s answer' }).click();
  await startTeaching(page);
  await fillCrow(page, '0', '2', 'red', 'blue');
  await fillFraction(page, 'Teaching answer', '0', '1');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(candidates(page).getByText('Retained', { exact: true })).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Start final verification' }),
  ).toBeDisabled();
  await fillCrow(page, '3', '2', 'red', 'blue');
  await fillFraction(page, 'Teaching answer', '6', '20');
  await page.getByRole('button', { name: 'Submit a correct example' }).click();
  await expect(candidates(page).getByText('Eliminated', { exact: true })).toHaveCount(2);
  await finishVerification(page, 'chancecrow');
  await expect(page.getByText(/student and crow passed verification/)).toHaveCount(3);
});

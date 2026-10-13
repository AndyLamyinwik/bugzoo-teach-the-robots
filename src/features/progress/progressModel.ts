import type { RobotKind } from '../../components/RobotPortrait';
import type { Locale } from '../../i18n';
import { lessonIds } from '../../progress';
import type { LessonId, LessonSummary } from '../../progress';
import { progressCopy } from './progressCopy';

export const progressLessonIds = lessonIds;

interface LessonDetails {
  readonly name: string;
  readonly kind: RobotKind;
  readonly topic: readonly [string, string];
  readonly concept: readonly [string, string];
  readonly achievement: readonly [string, string];
  readonly achievementDescription: readonly [string, string];
  readonly misconceptions: Readonly<Record<string, readonly [string, string]>>;
}

export const progressLessonDetails: Readonly<Record<LessonId, LessonDetails>> = {
  fractionfox: {
    name: 'FractionFox',
    kind: 'fox',
    topic: ['分數加法', 'Fraction addition'],
    concept: [
      '分數相加要先通分，讓每一份代表相同大小的單位，再相加分子。例如 1/2 + 1/3 = 3/6 + 2/6 = 5/6。',
      'Use a common denominator so each part represents the same-sized unit, then add the numerators. For example, 1/2 + 1/3 = 3/6 + 2/6 = 5/6.',
    ],
    achievement: ['相同單位的解說員', 'Common-unit explainer'],
    achievementDescription: [
      '你用正確示例排除了 FractionFox 的兩條已知迷思規則，讓牠採用通分後相加的規則；你與牠都通過了三道未見題。',
      'Your correct examples ruled out FractionFox’s two known misconception rules, leaving common-denominator addition. You and FractionFox both passed three unseen questions.',
    ],
    misconceptions: {
      'add-both': ['分子相加，分母也相加', 'Add both numerators and denominators'],
      'keep-first': [
        '分子相加，保留第一個分母',
        'Add numerators and keep the first denominator',
      ],
    },
  },
  discountpanda: {
    name: 'DiscountPanda',
    kind: 'panda',
    topic: ['連續百分比折扣', 'Successive percentage discounts'],
    concept: [
      '每次折扣都以當時的價格為基準。100 元先折 20%，再折 10%，是 100 × 0.8 × 0.9 = 72 元。中途不四捨五入，只在最終金額四捨五入到分。',
      'Each discount uses the current price. A price of 100 with 20% off and then 10% off becomes 100 × 0.8 × 0.9 = 72. Keep intermediate prices exact and round only the final price to cents.',
    ],
    achievement: ['折扣基準的追蹤員', 'Discount-base tracker'],
    achievementDescription: [
      '你用正確示例排除了 DiscountPanda 的兩條已知迷思規則，讓牠依每次折扣當時的價格計算；你與牠都通過了三道未見題。',
      'Your correct examples ruled out DiscountPanda’s two known misconception rules, leaving successive discounts based on the current price. You and DiscountPanda both passed three unseen questions.',
    ],
    misconceptions: {
      'add-discounts': ['將兩次折扣百分比直接相加', 'Add the two discount percentages'],
      'only-second': ['只套用第二次折扣', 'Apply only the second discount'],
    },
  },
  minusmole: {
    name: 'MinusMole',
    kind: 'mole',
    topic: ['負數減法', 'Subtraction with negative numbers'],
    concept: [
      '減正數在數線上向左移；減負數向右移。例如 3 − (−2) = 5，而 −3 − 2 = −5。結果的負號保留數值的方向，不能任意移除。',
      'Subtracting a positive number moves left on the number line; subtracting a negative number moves right. For example, 3 − (−2) = 5 and −3 − 2 = −5. A negative result keeps its sign.',
    ],
    achievement: ['數線方向的領航員', 'Number-line navigator'],
    achievementDescription: [
      '你用正確示例排除了 MinusMole 的兩條已知迷思規則，讓牠正確處理減正數與減負數的方向；你與牠都通過了三道未見題。',
      'Your correct examples ruled out MinusMole’s two known misconception rules, leaving the correct direction for subtracting positive and negative numbers. You and MinusMole both passed three unseen questions.',
    ],
    misconceptions: {
      'subtract-absolute': [
        '將減掉的數一律當成正數',
        'Always subtract the operand’s absolute value',
      ],
      'absolute-result': ['忽略結果的負號', 'Remove the negative sign from the result'],
    },
  },
  chancecrow: {
    name: 'ChanceCrow',
    kind: 'crow',
    topic: ['不放回抽樣機率', 'Probability without replacement'],
    concept: [
      '不放回抽球後，球袋總數與顏色數量都可能改變。3 紅 2 藍連抽兩紅的機率為 3/5 × 2/4 = 3/10。第一個目標事件不可能時，條件機率未定義、聯合機率為零；模擬頻率不能代替精確理論機率。',
      'Without replacement, the bag’s total and color counts can change. With 3 red and 2 blue balls, the probability of drawing two reds is 3/5 × 2/4 = 3/10. If the first target event is impossible, its conditional probability is undefined and the joint probability is zero. Simulated frequencies do not replace exact theoretical probabilities.',
    ],
    achievement: ['條件機率的觀察員', 'Conditional-probability observer'],
    achievementDescription: [
      '你用正確示例排除了 ChanceCrow 的兩條已知迷思規則，讓牠依不放回的條件計算聯合機率；你與牠都通過了三道未見題。',
      'Your correct examples ruled out ChanceCrow’s two known misconception rules, leaving joint probability conditioned on drawing without replacement. You and ChanceCrow both passed three unseen questions.',
    ],
    misconceptions: {
      independent: [
        '把不放回的兩次抽球當成獨立事件',
        'Treat draws without replacement as independent',
      ],
      'second-only': ['只看第二次的顏色機率', 'Use only the second color’s probability'],
    },
  },
};

export interface ProgressTotals {
  readonly completed: number;
  readonly inProgress: number;
  readonly effectiveExamples: number;
  readonly verified: number;
}

export function summarizeProgress(summaries: readonly LessonSummary[]): ProgressTotals {
  return summaries.reduce<ProgressTotals>(
    (totals, lesson) => ({
      completed: totals.completed + Number(lesson.status === 'complete'),
      inProgress: totals.inProgress + Number(lesson.status === 'in-progress'),
      effectiveExamples: totals.effectiveExamples + lesson.effectiveExamples,
      verified:
        totals.verified +
        Number(
          lesson.status === 'complete' &&
            lesson.verificationPassed === lesson.verificationTotal,
        ),
    }),
    { completed: 0, inProgress: 0, effectiveExamples: 0, verified: 0 },
  );
}

export function earnedAchievements(
  summaries: readonly LessonSummary[],
): readonly LessonId[] {
  return summaries
    .filter(
      (lesson) =>
        lesson.status === 'complete' &&
        lesson.verificationPassed === lesson.verificationTotal,
    )
    .map((lesson) => lesson.lessonId);
}

export function lessonStatusLabel(
  status: LessonSummary['status'],
  locale: Locale,
): string {
  const copy = progressCopy(locale);
  return status === 'complete'
    ? copy.complete
    : status === 'in-progress'
      ? copy.active
      : copy.notStarted;
}

export function verificationLabel(lesson: LessonSummary, locale: Locale): string {
  const copy = progressCopy(locale);
  return lesson.status === 'complete'
    ? copy.verificationPassed
    : lesson.stage === 'verify'
      ? copy.verificationPartial
      : copy.verificationNotStarted;
}

export function lessonText(values: readonly [string, string], locale: Locale): string {
  return values[locale === 'en' ? 1 : 0];
}

export function eliminatedMisconceptions(
  lesson: LessonSummary,
  locale: Locale,
): readonly string[] {
  const misconceptions = progressLessonDetails[lesson.lessonId].misconceptions;
  return lesson.eliminatedRuleIds.flatMap((id) => {
    const value = misconceptions[id];
    return value ? [lessonText(value, locale)] : [];
  });
}

import type { ReasoningRule, RuleEvaluation } from '../contracts';
import { createRational } from '../math/rational';
import type { Rational } from '../math/rational';

export type RuleId = 'correct' | 'add-discounts' | 'only-second';

/** Money is integer cents; discount percentages use 100 basis points per percent. */
export interface DiscountInput {
  readonly priceCents: bigint;
  readonly firstDiscount: bigint;
  readonly secondDiscount: bigint;
}

export interface PriceStage {
  readonly label: string;
  readonly exactPriceCents: Rational;
}

const fullPrice = 10_000n;

function formatHundredths(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function formatMoney(cents: bigint): string {
  return formatHundredths(cents);
}

export function formatPercent(basisPoints: bigint): string {
  return formatHundredths(basisPoints);
}

/** Exact yuan notation, including fractional cents; no intermediate money rounding. */
export function formatExactMoney(value: Rational): string {
  if (value.denominator <= 0n) {
    throw new RangeError('An exact money value needs a positive denominator.');
  }
  const denominator = value.denominator * 100n;
  const sign = value.numerator < 0n ? '-' : '';
  const absolute = value.numerator < 0n ? -value.numerator : value.numerator;
  let finiteDenominator = denominator;
  while (finiteDenominator % 2n === 0n) finiteDenominator /= 2n;
  while (finiteDenominator % 5n === 0n) finiteDenominator /= 5n;
  if (finiteDenominator !== 1n) {
    return `${value.numerator}/${denominator}`;
  }

  let remainder = absolute % denominator;
  let decimals = '';
  while (remainder !== 0n) {
    remainder *= 10n;
    decimals += (remainder / denominator).toString();
    remainder %= denominator;
  }
  return `${sign}${absolute / denominator}.${decimals.padEnd(2, '0')}`;
}

function applyDiscount(price: Rational, discount: bigint): Rational {
  return createRational(
    price.numerator * (fullPrice - discount),
    price.denominator * fullPrice,
  );
}

/** The correct rule and its visualization consume the same exact price stages. */
export function getPriceStages(
  input: DiscountInput,
): readonly [PriceStage, PriceStage, PriceStage] {
  const original = createRational(input.priceCents, 1n);
  const first = applyDiscount(original, input.firstDiscount);
  const final = applyDiscount(first, input.secondDiscount);
  return [
    { label: '商品原價', exactPriceCents: original },
    { label: '第一次折後價格', exactPriceCents: first },
    { label: '第二次折後價格', exactPriceCents: final },
  ];
}

/** Half-up applies once to the final nonnegative price, in units of one cent. */
function roundFinalCents(price: Rational): bigint {
  const wholeCents = price.numerator / price.denominator;
  const remainder = price.numerator % price.denominator;
  return wholeCents + (remainder * 2n >= price.denominator ? 1n : 0n);
}

function finalStep(exactPrice: Rational, answer: bigint) {
  return {
    explanationKey: 'discount.round-final',
    parameters: { exactPrice: formatExactMoney(exactPrice), answer: formatMoney(answer) },
  };
}

const correctRule: ReasoningRule<DiscountInput, bigint, 'correct'> = {
  id: 'correct',
  kind: 'correct',
  descriptionKey: 'discount.rule.correct',
  evaluate: ({ priceCents, firstDiscount, secondDiscount }) => {
    const [, firstStage, finalStage] = getPriceStages({
      priceCents,
      firstDiscount,
      secondDiscount,
    });
    const firstPrice = firstStage.exactPriceCents;
    const finalPrice = finalStage.exactPriceCents;
    const answer = roundFinalCents(finalPrice);
    return {
      answer,
      steps: [
        {
          explanationKey: 'discount.first-applied',
          parameters: {
            originalPrice: formatMoney(priceCents),
            discount: formatPercent(firstDiscount),
            remainingPercent: formatPercent(fullPrice - firstDiscount),
            exactPrice: formatExactMoney(firstPrice),
          },
        },
        {
          explanationKey: 'discount.second-applied',
          parameters: {
            previousExactPrice: formatExactMoney(firstPrice),
            discount: formatPercent(secondDiscount),
            remainingPercent: formatPercent(fullPrice - secondDiscount),
            exactPrice: formatExactMoney(finalPrice),
          },
        },
        finalStep(finalPrice, answer),
      ],
    };
  },
};

const addDiscountsRule: ReasoningRule<DiscountInput, bigint, 'misconception'> = {
  id: 'add-discounts',
  kind: 'misconception',
  descriptionKey: 'discount.rule.add-discounts',
  evaluate: ({ priceCents, firstDiscount, secondDiscount }) => {
    const sum = firstDiscount + secondDiscount;
    const effectiveDiscount = sum > fullPrice ? fullPrice : sum;
    const finalPrice = applyDiscount(createRational(priceCents, 1n), effectiveDiscount);
    const answer = roundFinalCents(finalPrice);
    return {
      answer,
      steps: [
        {
          explanationKey: 'discount.add-discounts',
          parameters: {
            firstDiscount: formatPercent(firstDiscount),
            secondDiscount: formatPercent(secondDiscount),
            summedDiscount: formatPercent(sum),
            effectiveDiscount: formatPercent(effectiveDiscount),
            originalPrice: formatMoney(priceCents),
            exactPrice: formatExactMoney(finalPrice),
          },
        },
        finalStep(finalPrice, answer),
      ],
    };
  },
};

const onlySecondRule: ReasoningRule<DiscountInput, bigint, 'misconception'> = {
  id: 'only-second',
  kind: 'misconception',
  descriptionKey: 'discount.rule.only-second',
  evaluate: ({ priceCents, firstDiscount, secondDiscount }) => {
    const finalPrice = applyDiscount(createRational(priceCents, 1n), secondDiscount);
    const answer = roundFinalCents(finalPrice);
    return {
      answer,
      steps: [
        {
          explanationKey: 'discount.only-second',
          parameters: {
            originalPrice: formatMoney(priceCents),
            ignoredDiscount: formatPercent(firstDiscount),
            discount: formatPercent(secondDiscount),
            exactPrice: formatExactMoney(finalPrice),
          },
        },
        finalStep(finalPrice, answer),
      ],
    };
  },
};

export const ruleDefinitions = {
  correct: correctRule,
  'add-discounts': addDiscountsRule,
  'only-second': onlySecondRule,
} satisfies Readonly<Record<RuleId, ReasoningRule<DiscountInput, bigint>>>;

export function evaluateRule(id: RuleId, input: DiscountInput): RuleEvaluation<bigint> {
  return ruleDefinitions[id].evaluate(input);
}

/** All displayed prices come from the evaluation trace rather than a second calculation. */
export function explainEvaluation(evaluation: RuleEvaluation<bigint>): readonly string[] {
  return evaluation.steps.map(({ explanationKey, parameters = {} }) => {
    switch (explanationKey) {
      case 'discount.first-applied':
        return `原價 ${parameters.originalPrice} 元先折扣 ${parameters.discount}%，留下 ${parameters.remainingPercent}%，精確價格是 ${parameters.exactPrice} 元，這一步不四捨五入。`;
      case 'discount.second-applied':
        return `再以 ${parameters.previousExactPrice} 元為基準折扣 ${parameters.discount}%，留下 ${parameters.remainingPercent}%，精確價格是 ${parameters.exactPrice} 元。`;
      case 'discount.add-discounts':
        return `把兩次折扣直接相加：${parameters.firstDiscount}% + ${parameters.secondDiscount}% = ${parameters.summedDiscount}%；最多扣除 100%，所以用 ${parameters.effectiveDiscount}% 折扣原價 ${parameters.originalPrice} 元，得到 ${parameters.exactPrice} 元，忽略了第二次的價格基準已改變。`;
      case 'discount.only-second':
        return `忽略第一次 ${parameters.ignoredDiscount}% 折扣，只對原價 ${parameters.originalPrice} 元套用第二次 ${parameters.discount}% 折扣，得到 ${parameters.exactPrice} 元。`;
      case 'discount.round-final':
        return `最後才把 ${parameters.exactPrice} 元以 half-up 四捨五入到分，付款金額是 ${parameters.answer} 元。`;
      default:
        return explanationKey;
    }
  });
}

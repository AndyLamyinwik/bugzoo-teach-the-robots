import type { ReasoningRule, RuleEvaluation } from '../contracts';
import { createRational } from '../math/rational';
import type { Rational } from '../math/rational';

export type RuleId = 'correct' | 'add-both' | 'keep-first';

/** Entered terms are preserved, including 2/4; only rule outputs are normalized. */
export interface AdditionInput {
  readonly left: Rational;
  readonly right: Rational;
}

export function formatFraction(value: Rational): string {
  return `${value.numerator}/${value.denominator}`;
}

const correctRule: ReasoningRule<AdditionInput, Rational, 'correct'> = {
  id: 'correct',
  kind: 'correct',
  descriptionKey: 'fraction.rule.correct',
  evaluate: ({ left, right }) => {
    const denominator = left.denominator * right.denominator;
    const leftNumerator = left.numerator * right.denominator;
    const rightNumerator = right.numerator * left.denominator;
    const numerator = leftNumerator + rightNumerator;
    const answer = createRational(numerator, denominator);

    return {
      answer,
      steps: [
        {
          explanationKey: 'fraction.common-unit',
          parameters: {
            denominator: denominator.toString(),
            leftNumerator: leftNumerator.toString(),
            rightNumerator: rightNumerator.toString(),
          },
        },
        {
          explanationKey: 'fraction.add-scaled',
          parameters: {
            numerator: numerator.toString(),
            denominator: denominator.toString(),
          },
        },
        {
          explanationKey: 'fraction.simplify',
          parameters: { answer: formatFraction(answer) },
        },
      ],
    };
  },
};

const addBothRule: ReasoningRule<AdditionInput, Rational, 'misconception'> = {
  id: 'add-both',
  kind: 'misconception',
  descriptionKey: 'fraction.rule.add-both',
  evaluate: ({ left, right }) => {
    const numerator = left.numerator + right.numerator;
    const denominator = left.denominator + right.denominator;
    const answer = createRational(numerator, denominator);
    return {
      answer,
      steps: [
        {
          explanationKey: 'fraction.add-both',
          parameters: {
            numerator: numerator.toString(),
            denominator: denominator.toString(),
          },
        },
        {
          explanationKey: 'fraction.simplify',
          parameters: { answer: formatFraction(answer) },
        },
      ],
    };
  },
};

const keepFirstRule: ReasoningRule<AdditionInput, Rational, 'misconception'> = {
  id: 'keep-first',
  kind: 'misconception',
  descriptionKey: 'fraction.rule.keep-first',
  evaluate: ({ left, right }) => {
    const numerator = left.numerator + right.numerator;
    const denominator = left.denominator;
    const answer = createRational(numerator, denominator);
    return {
      answer,
      steps: [
        {
          explanationKey: 'fraction.keep-first',
          parameters: {
            numerator: numerator.toString(),
            denominator: denominator.toString(),
          },
        },
        {
          explanationKey: 'fraction.simplify',
          parameters: { answer: formatFraction(answer) },
        },
      ],
    };
  },
};

export const ruleDefinitions = {
  correct: correctRule,
  'add-both': addBothRule,
  'keep-first': keepFirstRule,
} satisfies Readonly<Record<RuleId, ReasoningRule<AdditionInput, Rational>>>;

export function evaluateRule(id: RuleId, input: AdditionInput): RuleEvaluation<Rational> {
  return ruleDefinitions[id].evaluate(input);
}

/** Presentation-ready explanations derive from the trace, never a second calculation. */
export function explainEvaluation(
  evaluation: RuleEvaluation<Rational>,
): readonly string[] {
  return evaluation.steps.map(({ explanationKey, parameters = {} }) => {
    switch (explanationKey) {
      case 'fraction.common-unit':
        return `先使用共同分母 ${parameters.denominator}，兩個分子分別變成 ${parameters.leftNumerator} 與 ${parameters.rightNumerator}。`;
      case 'fraction.add-scaled':
        return `相同大小的單位相加，得到 ${parameters.numerator}/${parameters.denominator}。`;
      case 'fraction.add-both':
        return `直接將分子相加、分母也相加，得到 ${parameters.numerator}/${parameters.denominator}；沒有先統一單位。`;
      case 'fraction.keep-first':
        return `直接把分子相加，保留第一個分母，得到 ${parameters.numerator}/${parameters.denominator}；沒有換算第二個分數。`;
      case 'fraction.simplify':
        return `約分後的答案是 ${parameters.answer}。`;
      default:
        return explanationKey;
    }
  });
}

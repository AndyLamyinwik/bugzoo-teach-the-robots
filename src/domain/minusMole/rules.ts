import type { ReasoningRule, RuleEvaluation } from '../contracts';
import { createNumberLineModel } from './numberLine';

export type RuleId = 'correct' | 'subtract-absolute' | 'absolute-result';

export interface SubtractionInput {
  readonly a: bigint;
  readonly b: bigint;
}

export function formatInteger(value: bigint): string {
  return value.toString();
}

function evaluation(input: SubtractionInput, ruleId: RuleId): RuleEvaluation<bigint> {
  const model = createNumberLineModel(input, ruleId);
  return {
    answer: model.end,
    steps: [
      ...model.segments.map((item) => ({
        explanationKey:
          item.kind === 'reflect'
            ? 'minus.reflect-result'
            : ruleId === 'subtract-absolute'
              ? 'minus.subtract-absolute'
              : 'minus.subtract',
        parameters: {
          from: item.from.toString(),
          to: item.to.toString(),
          direction: item.direction,
          distance: item.distance.toString(),
          label: item.label,
        },
      })),
      {
        explanationKey: 'minus.result',
        parameters: {
          expression: `${input.a} − (${input.b})`,
          answer: model.end.toString(),
        },
      },
    ],
  };
}

const correctRule: ReasoningRule<SubtractionInput, bigint, 'correct'> = {
  id: 'correct',
  kind: 'correct',
  descriptionKey: 'minus.rule.correct',
  evaluate: (input) => evaluation(input, 'correct'),
};

const subtractAbsoluteRule: ReasoningRule<SubtractionInput, bigint, 'misconception'> = {
  id: 'subtract-absolute',
  kind: 'misconception',
  descriptionKey: 'minus.rule.subtract-absolute',
  evaluate: (input) => evaluation(input, 'subtract-absolute'),
};

const absoluteResultRule: ReasoningRule<SubtractionInput, bigint, 'misconception'> = {
  id: 'absolute-result',
  kind: 'misconception',
  descriptionKey: 'minus.rule.absolute-result',
  evaluate: (input) => evaluation(input, 'absolute-result'),
};

export const ruleDefinitions = {
  correct: correctRule,
  'subtract-absolute': subtractAbsoluteRule,
  'absolute-result': absoluteResultRule,
} satisfies Readonly<Record<RuleId, ReasoningRule<SubtractionInput, bigint>>>;

export function evaluateRule(
  id: RuleId,
  input: SubtractionInput,
): RuleEvaluation<bigint> {
  return ruleDefinitions[id].evaluate(input);
}

export function explainEvaluation(result: RuleEvaluation<bigint>): readonly string[] {
  return result.steps.map(({ explanationKey, parameters = {} }) =>
    explanationKey === 'minus.result'
      ? `這條規則給出的答案是 ${parameters.answer}。`
      : (parameters.label ?? explanationKey),
  );
}

import type { ReasoningRule, ReasoningStep, RuleEvaluation } from '../contracts';
import { createRational } from '../math/rational';
import type { Rational } from '../math/rational';
import { colorLabel, createProbabilityModel } from './probability';
import type { ChanceInput } from './probability';

export type RuleId = 'correct' | 'independent' | 'second-only';

export function formatProbability(value: Rational): string {
  return `${value.numerator}/${value.denominator}`;
}

const correctRule: ReasoningRule<ChanceInput, Rational, 'correct'> = {
  id: 'correct',
  kind: 'correct',
  descriptionKey: 'chance.rule.correct',
  evaluate: (input) => {
    const model = createProbabilityModel(input);
    const steps: ReasoningStep[] = [
      {
        explanationKey: 'chance.first',
        parameters: {
          color: colorLabel(input.first),
          count: model.firstCount.toString(),
          total: model.total.toString(),
          probability: formatProbability(model.firstProbability),
        },
      },
    ];
    if (model.conditionalSecond === null || model.remainingCounts === null) {
      steps.push({
        explanationKey: 'chance.impossible-first',
        parameters: {
          color: colorLabel(input.first),
          answer: formatProbability(model.joint),
        },
      });
    } else {
      steps.push({
        explanationKey: 'chance.conditional',
        parameters: {
          firstColor: colorLabel(input.first),
          secondColor: colorLabel(input.second),
          red: model.remainingCounts.red.toString(),
          blue: model.remainingCounts.blue.toString(),
          total: (model.total - 1n).toString(),
          probability: formatProbability(model.conditionalSecond),
        },
      });
      steps.push({
        explanationKey: 'chance.multiply',
        parameters: {
          first: formatProbability(model.firstProbability),
          second: formatProbability(model.conditionalSecond),
          answer: formatProbability(model.joint),
        },
      });
    }
    return { answer: model.joint, steps };
  },
};

const independentRule: ReasoningRule<ChanceInput, Rational, 'misconception'> = {
  id: 'independent',
  kind: 'misconception',
  descriptionKey: 'chance.rule.independent',
  evaluate: (input) => {
    const model = createProbabilityModel(input);
    const second = createRational(model.secondCountBefore, model.total);
    const answer = createRational(
      model.firstProbability.numerator * second.numerator,
      model.firstProbability.denominator * second.denominator,
    );
    return {
      answer,
      steps: [
        {
          explanationKey: 'chance.independent',
          parameters: {
            first: formatProbability(model.firstProbability),
            second: formatProbability(second),
            answer: formatProbability(answer),
            total: model.total.toString(),
          },
        },
      ],
    };
  },
};

const secondOnlyRule: ReasoningRule<ChanceInput, Rational, 'misconception'> = {
  id: 'second-only',
  kind: 'misconception',
  descriptionKey: 'chance.rule.second-only',
  evaluate: (input) => {
    const model = createProbabilityModel(input);
    const answer = createRational(model.secondCountBefore, model.total);
    return {
      answer,
      steps: [
        {
          explanationKey: 'chance.second-only',
          parameters: {
            color: colorLabel(input.second),
            count: model.secondCountBefore.toString(),
            total: model.total.toString(),
            answer: formatProbability(answer),
          },
        },
      ],
    };
  },
};

export const ruleDefinitions = {
  correct: correctRule,
  independent: independentRule,
  'second-only': secondOnlyRule,
} satisfies Readonly<Record<RuleId, ReasoningRule<ChanceInput, Rational>>>;

export function evaluateRule(id: RuleId, input: ChanceInput): RuleEvaluation<Rational> {
  return ruleDefinitions[id].evaluate(input);
}

export function explainEvaluation(
  evaluation: RuleEvaluation<Rational>,
): readonly string[] {
  return evaluation.steps.map(({ explanationKey, parameters = {} }) => {
    switch (explanationKey) {
      case 'chance.first':
        return `第一球要抽到${parameters.color}：${parameters.count} 顆目標球，共 ${parameters.total} 顆，機率是 ${parameters.probability}。`;
      case 'chance.impossible-first':
        return `袋中沒有${parameters.color}，第一球目標不可能發生。這個條件下第二球的條件機率不存在；整個目標序列的聯合機率是 ${parameters.answer}。`;
      case 'chance.conditional':
        return `假設第一球抽到${parameters.firstColor}且不放回，剩 ${parameters.red} 顆紅球、${parameters.blue} 顆藍球，共 ${parameters.total} 顆。第二球抽到${parameters.secondColor}的條件機率是 ${parameters.probability}。`;
      case 'chance.multiply':
        return `相乘兩個步驟：${parameters.first} × ${parameters.second} = ${parameters.answer}。`;
      case 'chance.independent':
        return `錯誤規則把兩次抽球當成獨立事件，第二球仍用原來的 ${parameters.total} 顆球計算：${parameters.first} × ${parameters.second} = ${parameters.answer}，忽略第一球已被移除。`;
      case 'chance.second-only':
        return `錯誤規則只看第二球顏色，使用原袋 ${parameters.count}/${parameters.total} 的${parameters.color}比例，得到 ${parameters.answer}。這是第二球單一事件的邊際機率，不能當作「第一次目標且第二次目標」的聯合機率。`;
      default:
        return explanationKey;
    }
  });
}

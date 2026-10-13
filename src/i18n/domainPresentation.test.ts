import { describe, expect, it } from 'vitest';
import {
  evaluateRule as fractionRule,
  explainEvaluation as fractionExplanation,
  observationInput as fractionInput,
} from '../domain/fractionFox/engine';
import {
  evaluateRule as discountRule,
  explainEvaluation as discountExplanation,
  observationInput as discountInput,
} from '../domain/discountPanda/engine';
import {
  evaluateRule as minusRule,
  explainEvaluation as minusExplanation,
  observationInput as minusInput,
} from '../domain/minusMole/engine';
import {
  evaluateRule as chanceRule,
  explainEvaluation as chanceExplanation,
  observationInput as chanceInput,
} from '../domain/chanceCrow/engine';
import { createNumberLineModel } from '../domain/minusMole/numberLine';
import { englishMessages, translate } from './messages';
import type { MessageKey } from './messages';
import {
  explainLocalizedEvaluation,
  localizeFeedback,
  localizeNumberLineLabel,
} from './domainPresentation';

describe('localized domain presentation keeps deterministic mathematics intact', () => {
  it('retains a literal message-key type and the same interpolation parameters in both languages', () => {
    const key: MessageKey = '分母不能為零。';
    // @ts-expect-error Arbitrary keys are not accepted by the component translator.
    const unknownKey: MessageKey = 'not-a-known-message';
    expect(unknownKey).toBe('not-a-known-message');
    expect(translate('zh-TW', key)).toBe(key);
    for (const [source, english] of Object.entries(englishMessages)) {
      expect(/[\u3400-\u9fff]/.test(english), source).toBe(false);
      const placeholders = (text: string) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(placeholders(english), source).toEqual(placeholders(source));
    }
  });

  it('preserves the original Chinese traces for all twelve rules and translates only presentation', () => {
    const cases = [
      ...(['correct', 'add-both', 'keep-first'] as const).map((id) => {
        const evaluation = fractionRule(id, fractionInput);
        return { evaluation, expected: fractionExplanation(evaluation) };
      }),
      ...(['correct', 'add-discounts', 'only-second'] as const).map((id) => {
        const evaluation = discountRule(id, discountInput);
        return { evaluation, expected: discountExplanation(evaluation) };
      }),
      ...(['correct', 'subtract-absolute', 'absolute-result'] as const).map((id) => {
        const evaluation = minusRule(id, minusInput);
        return { evaluation, expected: minusExplanation(evaluation) };
      }),
      ...(['correct', 'independent', 'second-only'] as const).map((id) => {
        const evaluation = chanceRule(id, chanceInput);
        return { evaluation, expected: chanceExplanation(evaluation) };
      }),
    ];
    for (const { evaluation, expected } of cases) {
      const before = evaluation.answer;
      expect(explainLocalizedEvaluation(evaluation, 'zh-TW')).toEqual(expected);
      const english = explainLocalizedEvaluation(evaluation, 'en').join(' ');
      expect(/[\u3400-\u9fff]/.test(english)).toBe(false);
      expect(english.includes('{v')).toBe(false);
      expect(evaluation.answer).toBe(before);
    }
  });

  it('explains impossible first events without multiplying an undefined conditional probability', () => {
    const input = { red: 0n, blue: 2n, first: 'red', second: 'blue' } as const;
    const evaluation = chanceRule('correct', input);
    const explanation = explainLocalizedEvaluation(evaluation, 'en').join(' ');
    expect(explanation).toContain('undefined');
    expect(explanation).toContain('0/1');
    expect(explanation.includes('Multiply the two steps')).toBe(false);
    expect(evaluation.answer).toEqual({ numerator: 0n, denominator: 1n });
  });

  it('describes subtraction and incorrect reflection separately using exact model coordinates', () => {
    const model = createNumberLineModel({ a: 2n, b: 5n }, 'absolute-result');
    expect(model.segments).toHaveLength(2);
    const labels = model.segments.map((segment) =>
      localizeNumberLineLabel(segment, 'en'),
    );
    expect(labels[0]).toContain('From 2, move left 5 units to -3');
    expect(labels[1]).toContain('negative result -3');
    expect(labels[1]).toContain('reflecting across zero to 3');
    expect(labels[1]).toContain('not a subtraction step');
    expect(
      model.segments.map((segment) => localizeNumberLineLabel(segment, 'zh-TW')),
    ).toEqual(model.segments.map((segment) => segment.label));
  });

  it('translates all validation domains and keeps duplicate issues concise', () => {
    const feedback = {
      kind: 'error',
      code: 'invalid-input',
      message: 'original',
      issues: [
        {
          code: 'zero-denominator',
          path: [],
          messageKey: 'fraction.validation.zero-denominator',
        },
        {
          code: 'zero-denominator',
          path: [],
          messageKey: 'fraction.validation.zero-denominator',
        },
        {
          code: 'money-format',
          path: [],
          messageKey: 'discount.validation.money-format',
        },
        { code: 'integer', path: [], messageKey: 'minus.validation.integer' },
        { code: 'total-bound', path: [], messageKey: 'chance.validation.total-bound' },
      ],
    } as const;
    const english = localizeFeedback(feedback, 'en', 'FractionFox');
    expect(english.match(/denominator cannot be zero/g)).toHaveLength(1);
    expect(english).toContain('two decimal places');
    expect(english).toContain('Enter an integer');
    expect(english).toContain('between 2 and 12');
    expect(localizeFeedback(feedback, 'zh-TW', 'FractionFox')).toBe('original');
  });

  it('keeps numerical hypothesis predictions and elimination counts in translated feedback', () => {
    const hypothesis = localizeFeedback(
      { kind: 'info', code: 'hypothesis-differs', message: 'original' },
      'en',
      'FractionFox',
      { prediction: '5/6', observed: '2/5' },
    );
    expect(hypothesis).toContain('predicts 5/6');
    expect(hypothesis).toContain('differs from the observed 2/5');
    const evidence = localizeFeedback(
      { kind: 'success', code: 'rules-eliminated', message: 'original' },
      'en',
      'MinusMole',
      { eliminated: 1 },
    );
    expect(evidence).toContain('eliminated 1 misconception rules');
    const complete = localizeFeedback(
      { kind: 'success', code: 'lesson-complete', message: 'original' },
      'en',
      'ChanceCrow',
    );
    expect(complete).toContain('ChanceCrow passed three unseen questions');
  });
});

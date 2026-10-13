import { describe, expect, it } from 'vitest';
import { fieldErrorId } from './fieldFeedback';
import type { Feedback } from '../domain/teaching/engine';

describe('field feedback association', () => {
  const invalid: Feedback = {
    kind: 'error',
    code: 'invalid-input',
    message: 'Invalid input',
    issues: [
      { code: 'integer', path: ['input', 'left', 'numerator'], messageKey: 'integer' },
    ],
  };

  it('marks only the field identified by the validation issue', () => {
    expect(fieldErrorId(invalid, ['input', 'left', 'numerator'], 'feedback')).toBe(
      'feedback',
    );
    expect(
      fieldErrorId(invalid, ['input', 'left', 'denominator'], 'feedback'),
    ).toBeUndefined();
    expect(
      fieldErrorId(invalid, ['input', 'right', 'numerator'], 'feedback'),
    ).toBeUndefined();
    expect(
      fieldErrorId(invalid, ['proposedAnswer', 'numerator'], 'feedback'),
    ).toBeUndefined();
  });

  it('associates aggregate probability and ball-count issues with their affected fields', () => {
    const aggregate: Feedback = {
      ...invalid,
      issues: [{ code: 'total', path: ['input'], messageKey: 'total' }],
    };
    expect(fieldErrorId(aggregate, ['input', 'red'], 'feedback')).toBe('feedback');
    expect(fieldErrorId(aggregate, ['input', 'blue'], 'feedback')).toBe('feedback');
    expect(fieldErrorId(aggregate, ['proposedAnswer'], 'feedback')).toBeUndefined();
    const probability: Feedback = {
      ...invalid,
      issues: [
        { code: 'probability', path: ['proposedAnswer'], messageKey: 'probability' },
      ],
    };
    expect(fieldErrorId(probability, ['proposedAnswer', 'numerator'], 'feedback')).toBe(
      'feedback',
    );
    expect(fieldErrorId(probability, ['proposedAnswer', 'denominator'], 'feedback')).toBe(
      'feedback',
    );
  });

  it.each(['incorrect-example', 'incorrect-verification'])(
    'marks incorrect mathematical answers without blaming valid operands (%s)',
    (code) => {
      const incorrect: Feedback = { kind: 'error', code, message: 'Try again' };
      expect(fieldErrorId(incorrect, ['proposedAnswer', 'numerator'], 'feedback')).toBe(
        'feedback',
      );
      expect(fieldErrorId(incorrect, ['input', 'a'], 'feedback')).toBeUndefined();
    },
  );

  it('keeps success, information, and unrelated stage errors off fields', () => {
    for (const feedback of [
      null,
      { ...invalid, kind: 'success' as const },
      { ...invalid, kind: 'info' as const },
      { kind: 'error' as const, code: 'not-ready', message: 'Finish teaching' },
    ]) {
      expect(
        fieldErrorId(feedback, ['input', 'left', 'numerator'], 'feedback'),
      ).toBeUndefined();
    }
  });
});

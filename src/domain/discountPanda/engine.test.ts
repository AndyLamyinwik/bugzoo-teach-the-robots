import { describe, expect, it } from 'vitest';
import { createRational } from '../math/rational';
import {
  answerVerification,
  beginHypothesis,
  beginTeaching,
  beginVerification,
  chooseHypothesis,
  createSession,
  discountPandaDefinition,
  evaluateRule,
  explainEvaluation,
  formatExactMoney,
  formatMoney,
  formatPercent,
  getPriceStages,
  isReadyForVerification,
  observationInput,
  parseDiscountInput,
  parseMoneyAnswer,
  resetSession,
  runExperiment,
  sameDiscountInput,
  teachExample,
} from './engine';
import type { DiscountInput, RawDiscountInput, SessionState } from './engine';

function draft(
  price = '100.00',
  firstDiscount = '20',
  secondDiscount = '10',
): RawDiscountInput {
  return { price, firstDiscount, secondDiscount };
}

function requireInput(value: RawDiscountInput): DiscountInput {
  const parsed = parseDiscountInput(value);
  if (!parsed.ok) throw new Error('Expected a valid fixture.');
  return parsed.value;
}

function experimentState(): SessionState {
  return chooseHypothesis(beginHypothesis(createSession()).state, 'add-discounts').state;
}

function teachingState(): SessionState {
  return beginTeaching(runExperiment(experimentState(), draft()).state).state;
}

function trainedState(): SessionState {
  return teachExample(teachingState(), { input: draft(), proposedAnswer: '72.00' }).state;
}

describe('DiscountPanda exact decimal validation', () => {
  it('parses yuan cents and percentage basis points directly from decimal strings', () => {
    expect(parseDiscountInput(draft('123.45', '12.34', '56.78'))).toEqual({
      ok: true,
      value: { priceCents: 12345n, firstDiscount: 1234n, secondDiscount: 5678n },
    });
    expect(parseDiscountInput(draft(' 001.5 ', '0', '100.00'))).toEqual({
      ok: true,
      value: { priceCents: 150n, firstDiscount: 0n, secondDiscount: 10000n },
    });
  });

  it('supports zero and inclusive price/percentage boundaries', () => {
    expect(parseDiscountInput(draft('0', '0', '0')).ok).toBe(true);
    expect(parseDiscountInput(draft('1000000.00', '100.00', '100')).ok).toBe(true);
    expect(parseMoneyAnswer('0')).toEqual({ ok: true, value: 0n });
    expect(parseMoneyAnswer('1000000.00')).toEqual({ ok: true, value: 100000000n });
  });

  it.each([
    null,
    [],
    {},
    { price: 100, firstDiscount: '20', secondDiscount: '10' },
    draft('-0.01'),
    draft('1000000.01'),
    draft('100.001'),
    draft('1e2'),
    draft('Infinity'),
    draft(''),
    draft('.50'),
    draft('1.'),
    draft('1', '-0.01'),
    draft('1', '100.01'),
    draft('1', '10.001'),
    draft('1', '10', '101'),
    draft('1', '10', '20.555'),
    draft('9'.repeat(1000)),
  ])('rejects malformed or out-of-range input %j', (candidate) => {
    expect(parseDiscountInput(candidate).ok).toBe(false);
  });

  it.each(['-0.01', '1000000.01', '0.001', '1e2', '', 'NaN', '9'.repeat(1000), 72, null])(
    'rejects invalid money answer %j',
    (candidate) => {
      expect(parseMoneyAnswer(candidate).ok).toBe(false);
    },
  );

  it('accepts equivalent money spellings but rejects fractional cents', () => {
    expect(parseMoneyAnswer('72')).toEqual({ ok: true, value: 7200n });
    expect(parseMoneyAnswer('072.0')).toEqual({ ok: true, value: 7200n });
    expect(parseMoneyAnswer('72.00')).toEqual({ ok: true, value: 7200n });
    expect(parseMoneyAnswer('72.000').ok).toBe(false);
    expect(discountPandaDefinition.domain.answersEqual(7200n, 7201n)).toBe(false);
  });

  it('validates the generic evidence contract including its answer boundary', () => {
    expect(
      discountPandaDefinition.domain.validateSubmission({
        input: draft(),
        proposedAnswer: '72',
      }),
    ).toEqual({
      ok: true,
      value: { input: observationInput, proposedAnswer: 7200n },
    });
    expect(discountPandaDefinition.domain.validateSubmission({ input: draft() }).ok).toBe(
      false,
    );
  });
});

describe('DiscountPanda deterministic rules and money rounding', () => {
  it('distinguishes successive discounts from adding them or forgetting the first', () => {
    expect(evaluateRule('correct', observationInput).answer).toBe(7200n);
    expect(evaluateRule('add-discounts', observationInput).answer).toBe(7000n);
    expect(evaluateRule('only-second', observationInput).answer).toBe(9000n);
  });

  it('keeps decimal percentage calculations exact without floating-point drift', () => {
    const result = evaluateRule(
      'correct',
      requireInput(draft('123.45', '12.34', '56.78')),
    );
    expect(result.answer).toBe(4677n);
    expect(result.steps[0]?.parameters?.exactPrice).toBe('108.21627');
    expect(result.steps[1]?.parameters?.exactPrice).toBe('46.771071894');
  });

  it('rounds 0.05 with 10% then 10% to 0.04, without rounding the first result', () => {
    const input = requireInput(draft('0.05', '10', '10'));
    const result = evaluateRule('correct', input);
    expect(result.answer).toBe(4n);
    expect(result.steps[0]?.parameters?.exactPrice).toBe('0.045');
    expect(result.steps[1]?.parameters?.exactPrice).toBe('0.0405');
    expect(result.steps[2]?.parameters).toEqual({ exactPrice: '0.0405', answer: '0.04' });
    const [, firstStage, finalStage] = getPriceStages(input);
    expect(firstStage.exactPriceCents).toEqual(createRational(9n, 2n));
    expect(finalStage.exactPriceCents).toEqual(createRational(81n, 20n));
  });

  it('uses half-up at an exact half cent and only rounds the final money value', () => {
    expect(evaluateRule('correct', requireInput(draft('0.01', '50', '0'))).answer).toBe(
      1n,
    );
    expect(evaluateRule('correct', requireInput(draft('0.05', '10', '0'))).answer).toBe(
      5n,
    );
    expect(
      evaluateRule('correct', requireInput(draft('0.01', '50.01', '0'))).answer,
    ).toBe(0n);
  });

  it('handles zero discounts, free goods, and a 100% discount', () => {
    expect(evaluateRule('correct', requireInput(draft('123.45', '0', '0'))).answer).toBe(
      12345n,
    );
    expect(evaluateRule('correct', requireInput(draft('0', '20', '10'))).answer).toBe(0n);
    expect(evaluateRule('correct', requireInput(draft('100', '100', '10'))).answer).toBe(
      0n,
    );
    expect(evaluateRule('correct', requireInput(draft('100', '20', '100'))).answer).toBe(
      0n,
    );
  });

  it('caps the added-discount misconception at 100% instead of producing a negative price', () => {
    const input = requireInput(draft('100', '80', '50'));
    const wrong = evaluateRule('add-discounts', input);
    expect(wrong.answer).toBe(0n);
    expect(wrong.steps[0]?.parameters?.summedDiscount).toBe('130.00');
    expect(wrong.steps[0]?.parameters?.effectiveDiscount).toBe('100.00');
    expect(evaluateRule('correct', input).answer).toBe(1000n);
    expect(evaluateRule('only-second', input).answer).toBe(5000n);
  });

  it('handles the maximum price with exact basis-point arithmetic', () => {
    expect(
      evaluateRule('correct', requireInput(draft('1000000.00', '0.01', '0.01'))).answer,
    ).toBe(99980001n);
  });

  it('produces reproducible traces without modifying the input', () => {
    const input = requireInput(draft('0.05', '10', '10'));
    const before = structuredClone(input);
    const result = evaluateRule('correct', input);
    expect(result).toEqual(evaluateRule('correct', input));
    expect(input).toEqual(before);
    const lines = explainEvaluation(result);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('0.045');
    expect(lines[2]).toContain('0.04');
    expect(lines.join(' ').includes('undefined')).toBe(false);
  });

  it('formats exact intermediate prices and final cents without Number conversion', () => {
    expect(formatMoney(7200n)).toBe('72.00');
    expect(formatMoney(1n)).toBe('0.01');
    expect(formatPercent(1234n)).toBe('12.34');
    expect(formatExactMoney(createRational(9n, 2n))).toBe('0.045');
    expect(formatExactMoney(createRational(10000n, 1n))).toBe('100.00');
    expect(formatExactMoney(createRational(0n, 1n))).toBe('0.00');
  });
});

describe('DiscountPanda shared teaching workflow', () => {
  it('starts with all candidates and the first misconception, without shortcutting stages', () => {
    const state = createSession();
    expect(state.stage).toBe('observe');
    expect(state.currentRuleId).toBe('add-discounts');
    expect(state.candidateRuleIds).toEqual(['correct', 'add-discounts', 'only-second']);
    expect(isReadyForVerification(state)).toBe(false);
    expect(beginTeaching(state).state).toBe(state);
    expect(beginVerification(state).feedback.code).toBe('invalid-stage');
    expect(teachExample(state, { input: draft(), proposedAnswer: '72' }).state).toBe(
      state,
    );
    expect(answerVerification(state, 'verify-1', '72').state).toBe(state);
  });

  it('records a hypothesis and experiments without treating them as teaching evidence', () => {
    const chosen = chooseHypothesis(
      beginHypothesis(createSession()).state,
      'only-second',
    );
    expect(chosen.state.stage).toBe('experiment');
    expect(chosen.feedback.code).toBe('hypothesis-differs');
    expect(chosen.state.candidateRuleIds).toHaveLength(3);
    expect(beginTeaching(chosen.state).feedback.code).toBe('experiment-required');
    const experiment = runExperiment(chosen.state, draft());
    expect(experiment.state.experiments[0]?.robotEvaluation.answer).toBe(7000n);
    expect(experiment.state.experiments[0]?.correctAnswer).toBe(7200n);
    expect(experiment.state.candidateRuleIds).toHaveLength(3);
  });

  it('rejects invalid experiments and teaching answers without changing state', () => {
    const experiment = experimentState();
    expect(runExperiment(experiment, draft('-1')).state).toBe(experiment);
    const state = teachingState();
    const before = structuredClone(state);
    expect(teachExample(state, { input: draft(), proposedAnswer: '70' }).state).toBe(
      state,
    );
    expect(teachExample(state, { input: draft(), proposedAnswer: '72.001' }).state).toBe(
      state,
    );
    expect(teachExample(state, { input: draft('-1'), proposedAnswer: '0' }).state).toBe(
      state,
    );
    expect(state).toEqual(before);
  });

  it('records a valid zero-price example without falsely pruning or claiming learning', () => {
    const state = teachingState();
    const result = teachExample(state, {
      input: draft('0', '20', '10'),
      proposedAnswer: '0',
    });
    expect(result.feedback.code).toBe('non-discriminating');
    expect(result.state.evidence).toHaveLength(1);
    expect(result.state.evidence[0]?.eliminatedRuleIds).toEqual([]);
    expect(result.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    expect(result.state.currentRuleId).toBe('add-discounts');
    expect(isReadyForVerification(result.state)).toBe(false);
    expect(beginVerification(result.state).feedback.code).toBe('teaching-required');
  });

  it('can eliminate one misconception before the other, updating the active rule', () => {
    const state = teachingState();
    const partial = teachExample(state, {
      input: draft('100', '20', '0'),
      proposedAnswer: '80',
    });
    expect(partial.state.candidateRuleIds).toEqual(['correct', 'add-discounts']);
    expect(partial.state.evidence[0]?.eliminatedRuleIds).toEqual(['only-second']);
    expect(partial.state.currentRuleId).toBe('add-discounts');
    expect(beginVerification(partial.state).feedback.code).toBe('teaching-required');
    const final = teachExample(partial.state, { input: draft(), proposedAnswer: '72.0' });
    expect(final.state.candidateRuleIds).toEqual(['correct']);
    expect(final.state.currentRuleId).toBe('correct');
    expect(final.state.evidence[1]?.eliminatedRuleIds).toEqual(['add-discounts']);
    expect(final.state.evidence[1]?.proposedAnswer).toBe(7200n);
    expect(isReadyForVerification(final.state)).toBe(true);
    expect(final.state.stage).toBe('teach');
  });

  it('can switch from add-discounts to only-second after an informative rounded example', () => {
    const partial = teachExample(teachingState(), {
      input: draft('0.05', '20', '80'),
      proposedAnswer: '0.01',
    });
    expect(partial.state.candidateRuleIds).toEqual(['correct', 'only-second']);
    // The final payment is 0.01 for correct and only-second, but 0.00 for add-discounts.
    expect(partial.state.evidence[0]?.eliminatedRuleIds).toEqual(['add-discounts']);
    expect(partial.state.currentRuleId).toBe('only-second');
    expect(beginVerification(partial.state).feedback.code).toBe('teaching-required');
  });

  it('rejects inconsistent candidates and reset clears all lesson state', () => {
    const state = teachingState();
    const broken: SessionState = { ...state, candidateRuleIds: [] };
    expect(
      teachExample(broken, { input: draft(), proposedAnswer: '72' }).feedback.code,
    ).toBe('inconsistent-state');
    expect(beginVerification(broken).state).toBe(broken);
    const verification = beginVerification(trainedState()).state;
    expect(verification.verification).toHaveLength(3);
    expect(resetSession()).toEqual(createSession());
    expect(resetSession().evidence).toEqual([]);
    expect(resetSession().verificationAnswers).toEqual([]);
  });
});

describe('DiscountPanda unseen verification and completion', () => {
  it('conservatively treats swapped discounts and alternate decimal spellings as seen', () => {
    expect(
      sameDiscountInput(
        requireInput(draft('100', '20', '10')),
        requireInput(draft('100.00', '10.00', '20.0')),
      ),
    ).toBe(true);
    expect(
      sameDiscountInput(
        requireInput(draft('100', '20', '10')),
        requireInput(draft('100.01', '20', '10')),
      ),
    ).toBe(false);
  });

  it('generates deterministic distinct questions excluding observation, experiments and evidence', () => {
    const experiment = runExperiment(experimentState(), draft('125', '25', '15')).state;
    const state = teachExample(beginTeaching(experiment).state, {
      input: draft(),
      proposedAnswer: '72',
    }).state;
    const first = beginVerification(state);
    expect(first).toEqual(beginVerification(state));
    expect(first.state.verification).toHaveLength(3);
    const seen = [
      observationInput,
      ...state.experiments.map((record) => record.input),
      ...state.evidence.map((record) => record.input),
    ];
    first.state.verification.forEach((question, index) => {
      expect(seen.some((input) => sameDiscountInput(input, question.input))).toBe(false);
      expect(
        first.state.verification
          .slice(0, index)
          .some((previous) => sameDiscountInput(previous.input, question.input)),
      ).toBe(false);
      expect(question.robotEvaluation.answer).toBe(question.correctAnswer);
    });
    expect(first.state.stage).toBe('verify');
    expect(first.state.verificationAnswers).toEqual([]);
  });

  it('falls back to a deterministic pool when the preferred questions have been taught', () => {
    let state = trainedState();
    for (const input of [
      draft('125', '15', '25'),
      draft('199.99', '33.33', '12.50'),
      draft('85', '40', '17.50'),
    ]) {
      const correct = evaluateRule('correct', requireInput(input)).answer;
      state = teachExample(state, { input, proposedAnswer: formatMoney(correct) }).state;
    }
    const verification = beginVerification(state);
    expect(verification.state.verification).toHaveLength(3);
    expect(verification.state.verification[0]?.input.priceCents).toBe(1n);
  });

  it('rejects wrong, invalid, repeated, and out-of-order answers without advancing', () => {
    const state = beginVerification(trainedState()).state;
    expect(answerVerification(state, 'verify-2', '0').feedback.code).toBe(
      'question-order',
    );
    expect(answerVerification(state, 'verify-1', '-1').state).toBe(state);
    expect(answerVerification(state, 'verify-1', '0').feedback.code).toBe(
      'incorrect-verification',
    );
    const question = state.verification[0];
    if (!question) throw new Error('Expected a verification question.');
    const accepted = answerVerification(
      state,
      question.id,
      formatMoney(question.correctAnswer),
    );
    expect(accepted.state.verificationAnswers).toHaveLength(1);
    expect(accepted.state.stage).toBe('verify');
    expect(
      answerVerification(accepted.state, question.id, formatMoney(question.correctAnswer))
        .feedback.code,
    ).toBe('question-order');
  });

  it('requires all three student answers and robot predictions before completion', () => {
    let state = beginVerification(trainedState()).state;
    for (let index = 0; index < 3; index += 1) {
      const question = state.verification[index];
      if (!question) throw new Error('Expected three verification questions.');
      state = answerVerification(
        state,
        question.id,
        formatMoney(question.correctAnswer),
      ).state;
      expect(state.stage).toBe(index === 2 ? 'complete' : 'verify');
    }
    expect(state.verificationAnswers).toHaveLength(3);
    expect(state.verificationAnswers.every((answer) => answer.robotWasCorrect)).toBe(
      true,
    );
    expect(answerVerification(state, 'verify-3', '42.08').feedback.code).toBe(
      'invalid-stage',
    );
  });

  it('refuses to complete when a stored robot prediction is wrong', () => {
    const state = beginVerification(trainedState()).state;
    const altered: SessionState = {
      ...state,
      verification: state.verification.map((question, index) =>
        index === 0
          ? { ...question, robotEvaluation: { ...question.robotEvaluation, answer: 0n } }
          : question,
      ),
    };
    const question = altered.verification[0];
    if (!question) throw new Error('Expected a verification question.');
    const rejected = answerVerification(
      altered,
      question.id,
      formatMoney(question.correctAnswer),
    );
    expect(rejected.state).toBe(altered);
    expect(rejected.feedback.code).toBe('robot-verification-failed');
  });
});

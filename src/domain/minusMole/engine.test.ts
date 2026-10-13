import { describe, expect, it } from 'vitest';

import {
  answerVerification,
  beginHypothesis,
  beginTeaching,
  beginVerification,
  chooseHypothesis,
  createSession,
  evaluateRule,
  explainEvaluation,
  formatInteger,
  isReadyForVerification,
  minusMoleDefinition,
  observationInput,
  parseIntegerAnswer,
  parseSubtractionInput,
  resetSession,
  runExperiment,
  sameSubtractionInput,
  signScenario,
  teachExample,
} from './engine';
import type {
  RawSubtractionInput,
  RuleId,
  SessionState,
  SubtractionInput,
} from './engine';

function draft(a = '5', b = '-3'): RawSubtractionInput {
  return { a, b };
}

function requireInput(candidate: RawSubtractionInput): SubtractionInput {
  const parsed = parseSubtractionInput(candidate);
  if (!parsed.ok) throw new Error('Expected a valid fixture.');
  return parsed.value;
}

function experimentState(): SessionState {
  return chooseHypothesis(beginHypothesis(createSession()).state, 'subtract-absolute')
    .state;
}

function teachingState(): SessionState {
  return beginTeaching(runExperiment(experimentState(), draft()).state).state;
}

function trainedState(): SessionState {
  const first = teachExample(teachingState(), {
    input: draft(),
    proposedAnswer: '8',
  }).state;
  return teachExample(first, { input: draft('-4', '3'), proposedAnswer: '-7' }).state;
}

describe('MinusMole strict integer boundary', () => {
  it('accepts bounded signed integer strings and canonicalizes equivalent spellings', () => {
    expect(parseSubtractionInput(draft(' -20 ', '+20'))).toEqual({
      ok: true,
      value: { a: -20n, b: 20n },
    });
    expect(parseSubtractionInput(draft('+005', '-03'))).toEqual({
      ok: true,
      value: observationInput,
    });
    expect(parseSubtractionInput(draft('0', '-0'))).toEqual({
      ok: true,
      value: { a: 0n, b: 0n },
    });
    expect(parseIntegerAnswer('-40')).toEqual({ ok: true, value: -40n });
    expect(parseIntegerAnswer('+40')).toEqual({ ok: true, value: 40n });
  });

  it.each([
    null,
    [],
    {},
    { a: '5' },
    { a: 5, b: '-3' },
    draft('', '-3'),
    draft(' ', '-3'),
    draft('5.0', '-3'),
    draft('1e1', '-3'),
    draft('0x10', '-3'),
    draft('NaN', '-3'),
    draft('Infinity', '-3'),
    draft('21', '-3'),
    draft('-21', '-3'),
    draft('5', '21'),
    draft('5', '-21'),
    draft('5', '2.5'),
    draft('9'.repeat(1000), '-3'),
  ])('rejects malformed or out-of-bound subtraction input %j', (candidate) => {
    expect(parseSubtractionInput(candidate).ok).toBe(false);
  });

  it.each(['', ' ', '8.0', '4e1', '-41', '41', 'NaN', '9'.repeat(1000), 8, null])(
    'rejects invalid answer %j',
    (candidate) => {
      expect(parseIntegerAnswer(candidate).ok).toBe(false);
    },
  );

  it('provides the existing domain validation and equality contract', () => {
    expect(
      minusMoleDefinition.domain.validateSubmission({
        input: draft(),
        proposedAnswer: '+008',
      }),
    ).toEqual({ ok: true, value: { input: observationInput, proposedAnswer: 8n } });
    expect(minusMoleDefinition.domain.answersEqual(-7n, 7n)).toBe(false);
    expect(minusMoleDefinition.domain.validateSubmission({ input: draft() }).ok).toBe(
      false,
    );
    expect(formatInteger(-20n)).toBe('-20');
  });
});

describe('MinusMole exact rules and path-derived explanations', () => {
  it('distinguishes subtracting a negative from subtracting its absolute value', () => {
    expect(evaluateRule('correct', observationInput).answer).toBe(8n);
    expect(evaluateRule('subtract-absolute', observationInput).answer).toBe(2n);
    expect(evaluateRule('absolute-result', observationInput).answer).toBe(8n);
  });

  it('preserves negative results and distinguishes forced-positive answers', () => {
    const input = requireInput(draft('-4', '3'));
    expect(evaluateRule('correct', input).answer).toBe(-7n);
    expect(evaluateRule('subtract-absolute', input).answer).toBe(-7n);
    const reflection = evaluateRule('absolute-result', input);
    expect(reflection.answer).toBe(7n);
    expect(reflection.steps[1]?.explanationKey).toBe('minus.reflect-result');
    expect(explainEvaluation(reflection).join(' ')).toContain('鏡射不是減法步驟');
  });

  it('handles negative-minus-negative, zero, and both extreme results', () => {
    expect(evaluateRule('correct', requireInput(draft('-3', '-8'))).answer).toBe(5n);
    expect(evaluateRule('correct', requireInput(draft('0', '0'))).answer).toBe(0n);
    expect(evaluateRule('correct', requireInput(draft('-20', '20'))).answer).toBe(-40n);
    expect(evaluateRule('correct', requireInput(draft('20', '-20'))).answer).toBe(40n);
  });

  it('matches the intended exact integer rules across all supported operands', () => {
    for (let a = -20n; a <= 20n; a += 1n) {
      for (let b = -20n; b <= 20n; b += 1n) {
        const correct = a - b;
        expect(evaluateRule('correct', { a, b }).answer).toBe(correct);
        expect(evaluateRule('subtract-absolute', { a, b }).answer).toBe(
          a - (b < 0n ? -b : b),
        );
        expect(evaluateRule('absolute-result', { a, b }).answer).toBe(
          correct < 0n ? -correct : correct,
        );
      }
    }
  });

  it('is deterministic, leaves input untouched and never emits undefined trace values', () => {
    const input = requireInput(draft('-4', '3'));
    const before = structuredClone(input);
    const ids: readonly RuleId[] = ['correct', 'subtract-absolute', 'absolute-result'];
    for (const id of ids) {
      const result = evaluateRule(id, input);
      expect(result).toEqual(evaluateRule(id, input));
      expect(explainEvaluation(result).join(' ').includes('undefined')).toBe(false);
    }
    expect(input).toEqual(before);
  });
});

describe('MinusMole shared teaching and completion guards', () => {
  it('starts with all hypotheses and rejects stage shortcuts', () => {
    const state = createSession();
    expect(state.currentRuleId).toBe('subtract-absolute');
    expect(state.candidateRuleIds).toEqual([
      'correct',
      'subtract-absolute',
      'absolute-result',
    ]);
    expect(beginTeaching(state).state).toBe(state);
    expect(beginVerification(state).feedback.code).toBe('invalid-stage');
    expect(answerVerification(state, 'verify-1', '8').state).toBe(state);
    expect(beginTeaching(experimentState()).feedback.code).toBe('experiment-required');
  });

  it('records guesses and experiments without pruning; wrong or invalid evidence changes nothing', () => {
    const guessed = chooseHypothesis(
      beginHypothesis(createSession()).state,
      'absolute-result',
    );
    expect(guessed.feedback.code).toBe('hypothesis-differs');
    expect(guessed.state.candidateRuleIds).toHaveLength(3);
    const tested = runExperiment(guessed.state, draft());
    expect(tested.state.experiments[0]?.robotEvaluation.answer).toBe(2n);
    expect(tested.state.experiments[0]?.correctAnswer).toBe(8n);
    expect(tested.state.candidateRuleIds).toHaveLength(3);
    const state = beginTeaching(tested.state).state;
    expect(teachExample(state, { input: draft(), proposedAnswer: '2' }).state).toBe(
      state,
    );
    expect(teachExample(state, { input: draft(), proposedAnswer: '8.0' }).state).toBe(
      state,
    );
    expect(
      teachExample(state, { input: draft('21', '-3'), proposedAnswer: '24' }).state,
    ).toBe(state);
  });

  it('records a non-discriminating zero example without learning', () => {
    const state = teachingState();
    const result = teachExample(state, { input: draft('0', '0'), proposedAnswer: '0' });
    expect(result.feedback.code).toBe('non-discriminating');
    expect(result.state.evidence).toHaveLength(1);
    expect(result.state.evidence[0]?.eliminatedRuleIds).toEqual([]);
    expect(result.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    expect(beginVerification(result.state).feedback.code).toBe('teaching-required');
  });

  it('eliminates misconceptions gradually with exact signed evidence and recorded reasons', () => {
    const state = teachingState();
    const first = teachExample(state, { input: draft(), proposedAnswer: '8' });
    expect(first.state.candidateRuleIds).toEqual(['correct', 'absolute-result']);
    expect(first.state.currentRuleId).toBe('absolute-result');
    expect(first.state.evidence[0]?.eliminatedRuleIds).toEqual(['subtract-absolute']);
    expect(
      first.state.evidence[0]?.comparisons.find(
        (comparison) => comparison.ruleId === 'subtract-absolute',
      ),
    ).toMatchObject({ compatible: false, evaluation: { answer: 2n } });
    expect(isReadyForVerification(first.state)).toBe(false);
    const second = teachExample(first.state, {
      input: draft('-4', '3'),
      proposedAnswer: '-7',
    });
    expect(second.state.candidateRuleIds).toEqual(['correct']);
    expect(second.state.currentRuleId).toBe('correct');
    expect(second.state.evidence[1]?.eliminatedRuleIds).toEqual(['absolute-result']);
    expect(isReadyForVerification(second.state)).toBe(true);
    expect(second.state.stage).toBe('teach');
    expect(state.evidence).toEqual([]);
  });

  it('resets state and refuses empty or incomplete verification states', () => {
    const trained = trainedState();
    const empty: SessionState = { ...trained, candidateRuleIds: [] };
    expect(beginVerification(empty).feedback.code).toBe('inconsistent-state');
    const verify = beginVerification(trained).state;
    expect(
      answerVerification({ ...verify, evidence: [] }, 'verify-1', '9').feedback.code,
    ).toBe('teaching-required');
    expect(resetSession()).toEqual(createSession());
    expect(resetSession().evidence).toEqual([]);
    expect(resetSession().verificationAnswers).toEqual([]);
  });
});

describe('MinusMole varied unseen questions', () => {
  it('uses ordered exact integer identity, not operand swapping', () => {
    expect(
      sameSubtractionInput(requireInput(draft('005', '-03')), observationInput),
    ).toBe(true);
    expect(sameSubtractionInput({ a: 5n, b: -3n }, { a: -3n, b: 5n })).toBe(false);
  });

  it('selects one unseen question per sign scenario deterministically', () => {
    const state = trainedState();
    const result = beginVerification(state);
    expect(result).toEqual(beginVerification(state));
    expect(
      result.state.verification.map((question) => signScenario(question.input)),
    ).toEqual([
      'positive-minus-negative',
      'negative-minus-positive',
      'negative-minus-negative',
    ]);
    const seen = [
      observationInput,
      ...state.experiments.map((record) => record.input),
      ...state.evidence.map((record) => record.input),
    ];
    result.state.verification.forEach((question) => {
      expect(seen.some((input) => sameSubtractionInput(input, question.input))).toBe(
        false,
      );
      expect(question.robotEvaluation.answer).toBe(question.correctAnswer);
    });
  });

  it('falls back within each scenario when all preferred examples were previously taught', () => {
    let state = trainedState();
    for (const input of [draft('7', '-2'), draft('-4', '3'), draft('-3', '-8')]) {
      const answer = evaluateRule('correct', requireInput(input)).answer;
      state = teachExample(state, { input, proposedAnswer: answer.toString() }).state;
    }
    const result = beginVerification(state);
    expect(result.state.verification).toHaveLength(3);
    expect(
      result.state.verification.map((question) => signScenario(question.input)),
    ).toEqual([
      'positive-minus-negative',
      'negative-minus-positive',
      'negative-minus-negative',
    ]);
    expect(result.state.verification.map((question) => question.input)).toEqual([
      { a: 1n, b: -20n },
      { a: -20n, b: 1n },
      { a: -20n, b: -20n },
    ]);
  });

  it('reports unavailable if an entire bounded sign scenario has already been seen', () => {
    const state = trainedState();
    const evidence = [...state.evidence];
    const template = state.evidence[0];
    if (!template) throw new Error('Expected teaching evidence.');
    for (let a = 1n; a <= 20n; a += 1n) {
      for (let b = -20n; b < 0n; b += 1n) {
        evidence.push({
          ...template,
          id: `fixture-${a}-${b}`,
          input: { a, b },
          proposedAnswer: a - b,
        });
      }
    }
    const exhausted: SessionState = { ...state, evidence };
    expect(beginVerification(exhausted).feedback.code).toBe('verification-unavailable');
    expect(beginVerification(exhausted).state).toBe(exhausted);
  });

  it('requires ordered student answers and correct robot results on all three new questions', () => {
    let state = beginVerification(trainedState()).state;
    expect(answerVerification(state, 'verify-2', '-7').feedback.code).toBe(
      'question-order',
    );
    expect(answerVerification(state, 'verify-1', '9.0').feedback.code).toBe(
      'invalid-input',
    );
    expect(answerVerification(state, 'verify-1', '0').feedback.code).toBe(
      'incorrect-verification',
    );
    const first = state.verification[0];
    if (!first) throw new Error('Expected three verification questions.');
    const wrongRobot: SessionState = {
      ...state,
      verification: state.verification.map((question) => ({
        ...question,
        robotEvaluation: { ...question.robotEvaluation, answer: 0n },
      })),
    };
    expect(
      answerVerification(wrongRobot, first.id, first.correctAnswer.toString()).feedback
        .code,
    ).toBe('robot-verification-failed');
    for (let index = 0; index < 3; index += 1) {
      const question = state.verification[index];
      if (!question) throw new Error('Expected three verification questions.');
      state = answerVerification(
        state,
        question.id,
        question.correctAnswer.toString(),
      ).state;
      expect(state.stage).toBe(index === 2 ? 'complete' : 'verify');
    }
    expect(state.verificationAnswers.every((answer) => answer.robotWasCorrect)).toBe(
      true,
    );
    expect(
      answerVerification(state, first.id, first.correctAnswer.toString()).feedback.code,
    ).toBe('invalid-stage');
  });
});

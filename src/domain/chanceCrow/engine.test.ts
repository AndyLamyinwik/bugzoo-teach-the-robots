import { describe, expect, it } from 'vitest';

import { createRational } from '../math/rational';
import {
  answerVerification,
  beginHypothesis,
  beginTeaching,
  beginVerification,
  chanceCrowDefinition,
  chooseHypothesis,
  createSession,
  evaluateRule,
  formatProbability,
  isReadyForVerification,
  observationInput,
  parseChanceInput,
  parseProbabilityAnswer,
  resetSession,
  runExperiment,
  sameChanceInput,
  teachExample,
  validationIssueMessage,
  verificationScenario,
} from './engine';
import type { ChanceInput, Color, RawChanceInput, SessionState } from './engine';

function draft(
  red = '3',
  blue = '2',
  first: Color = 'red',
  second: Color = 'blue',
): RawChanceInput {
  return { red, blue, first, second };
}
function answer(numerator: string, denominator = '1') {
  return { numerator, denominator };
}
function requireInput(raw: RawChanceInput): ChanceInput {
  const parsed = parseChanceInput(raw);
  if (!parsed.ok) throw new Error('Expected valid fixture.');
  return parsed.value;
}
function experimentState(): SessionState {
  return chooseHypothesis(beginHypothesis(createSession()).state, 'independent').state;
}
function teachingState(): SessionState {
  return beginTeaching(runExperiment(experimentState(), draft()).state).state;
}
function trainedState(): SessionState {
  return teachExample(teachingState(), {
    input: draft(),
    proposedAnswer: answer('6', '20'),
  }).state;
}

describe('ChanceCrow strict input and probability validation', () => {
  it('accepts bounded integer counts including absent target colors and equivalent text', () => {
    expect(parseChanceInput(draft(' +03 ', '02'))).toEqual({
      ok: true,
      value: observationInput,
    });
    expect(parseChanceInput(draft('0', '2')).ok).toBe(true);
    expect(parseChanceInput(draft('10', '2')).ok).toBe(true);
    expect(parseProbabilityAnswer(answer('6', '20'))).toEqual({
      ok: true,
      value: createRational(3n, 10n),
    });
    expect(parseProbabilityAnswer(answer('0', '999'))).toEqual({
      ok: true,
      value: createRational(0n, 1n),
    });
    expect(parseProbabilityAnswer(answer('1000000000000', '1000000000000'))).toEqual({
      ok: true,
      value: createRational(1n, 1n),
    });
  });

  it.each([
    null,
    [],
    {},
    { red: 3, blue: '2', first: 'red', second: 'blue' },
    draft('', '2'),
    draft(' ', '2'),
    draft('3.0', '2'),
    draft('1e1', '2'),
    draft('-1', '2'),
    draft('11', '0'),
    draft('0', '1'),
    draft('10', '3'),
    draft('9'.repeat(1000)),
    { ...draft(), first: 'green' },
    { ...draft(), second: null },
  ])('rejects malformed or unsupported bag %j', (raw) => {
    expect(parseChanceInput(raw).ok).toBe(false);
  });

  it.each([
    null,
    {},
    answer(''),
    answer('0.3'),
    answer('1e2'),
    answer('1', '0'),
    answer('1', '-2'),
    answer('-1', '2'),
    answer('3', '2'),
    answer('1000000000001', '1000000000001'),
    answer('9'.repeat(1000), '10'),
    { numerator: 1, denominator: '2' },
  ])('rejects malformed or out-of-range probability %j', (raw) => {
    expect(parseProbabilityAnswer(raw).ok).toBe(false);
  });

  it('implements the generic domain contract and user-readable validation reasons', () => {
    expect(
      chanceCrowDefinition.domain.validateSubmission({
        input: draft(),
        proposedAnswer: answer('3', '10'),
      }),
    ).toEqual({
      ok: true,
      value: { input: observationInput, proposedAnswer: createRational(3n, 10n) },
    });
    expect(chanceCrowDefinition.domain.validateSubmission({ input: draft() }).ok).toBe(
      false,
    );
    const invalid = parseChanceInput(draft('0', '1'));
    if (invalid.ok || !invalid.issues[0]) throw new Error('Expected total bound error.');
    expect(validationIssueMessage(invalid.issues[0])).toContain('2 與 12');
    expect(formatProbability(createRational(6n, 20n))).toBe('3/10');
  });
});

describe('ChanceCrow deterministic teaching evidence', () => {
  it('starts with all candidates and guards stage shortcuts', () => {
    const state = createSession();
    expect(state.currentRuleId).toBe('independent');
    expect(state.candidateRuleIds).toEqual(['correct', 'independent', 'second-only']);
    expect(beginVerification(state).feedback.code).toBe('invalid-stage');
    expect(beginTeaching(experimentState()).feedback.code).toBe('experiment-required');
    expect(answerVerification(state, 'verify-1', answer('3', '10')).state).toBe(state);
  });

  it('keeps guesses and experimental predictions separate from teaching evidence', () => {
    const guess = chooseHypothesis(beginHypothesis(createSession()).state, 'second-only');
    expect(guess.feedback.code).toBe('hypothesis-differs');
    const experiment = runExperiment(guess.state, draft());
    expect(experiment.state.experiments[0]?.robotEvaluation.answer).toEqual(
      createRational(6n, 25n),
    );
    expect(experiment.state.experiments[0]?.correctAnswer).toEqual(
      createRational(3n, 10n),
    );
    expect(experiment.state.candidateRuleIds).toHaveLength(3);
    expect(experiment.state.evidence).toEqual([]);
  });

  it('rejects wrong or invalid teaching answers without changing state', () => {
    const state = teachingState();
    const before = structuredClone(state);
    expect(
      teachExample(state, { input: draft(), proposedAnswer: answer('6', '25') }).state,
    ).toBe(state);
    expect(
      teachExample(state, { input: draft(), proposedAnswer: answer('3', '0') }).state,
    ).toBe(state);
    expect(
      teachExample(state, { input: draft('10', '10'), proposedAnswer: answer('3', '10') })
        .state,
    ).toBe(state);
    expect(state).toEqual(before);
  });

  it('records a non-discriminating certain event without claiming completion', () => {
    const state = teachingState();
    const certain = teachExample(state, {
      input: draft('2', '0', 'red', 'red'),
      proposedAnswer: answer('1'),
    });
    expect(certain.feedback.code).toBe('non-discriminating');
    expect(certain.state.evidence).toHaveLength(1);
    expect(certain.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    expect(isReadyForVerification(certain.state)).toBe(false);
  });

  it('uses an impossible-first boundary to eliminate only second-only, then teaches the conditional rule', () => {
    const partial = teachExample(teachingState(), {
      input: draft('0', '2', 'red', 'blue'),
      proposedAnswer: answer('0'),
    });
    expect(partial.state.candidateRuleIds).toEqual(['correct', 'independent']);
    expect(partial.state.evidence[0]?.eliminatedRuleIds).toEqual(['second-only']);
    expect(partial.state.currentRuleId).toBe('independent');
    expect(beginVerification(partial.state).feedback.code).toBe('teaching-required');
    const trained = teachExample(partial.state, {
      input: draft(),
      proposedAnswer: answer('6', '20'),
    });
    expect(trained.state.candidateRuleIds).toEqual(['correct']);
    expect(trained.state.currentRuleId).toBe('correct');
    expect(trained.state.evidence[1]?.eliminatedRuleIds).toEqual(['independent']);
    expect(
      trained.state.evidence[1]?.comparisons.find(
        (comparison) => comparison.ruleId === 'independent',
      ),
    ).toMatchObject({
      compatible: false,
      evaluation: { answer: createRational(6n, 25n) },
    });
    expect(trained.state.stage).toBe('teach');
  });

  it('keeps empty or incomplete states from completing and reset restores the original lesson', () => {
    const trained = trainedState();
    expect(beginVerification({ ...trained, candidateRuleIds: [] }).feedback.code).toBe(
      'inconsistent-state',
    );
    const verification = beginVerification(trained).state;
    expect(
      answerVerification({ ...verification, evidence: [] }, 'verify-1', answer('3', '10'))
        .feedback.code,
    ).toBe('teaching-required');
    expect(resetSession()).toEqual(createSession());
    expect(resetSession().verificationAnswers).toEqual([]);
    expect(resetSession().evidence).toEqual([]);
  });
});

describe('ChanceCrow varied unseen verification', () => {
  it('excludes newly submitted valid inputs even when their teaching answers were rejected', () => {
    const initial = teachingState();
    const raw = draft('2', '3');
    const wrong = teachExample(initial, { input: raw, proposedAnswer: answer('0') });
    expect(wrong.feedback.code).toBe('incorrect-example');
    expect(wrong.state.candidateRuleIds).toEqual(initial.candidateRuleIds);
    expect(wrong.state.evidence).toEqual(initial.evidence);
    expect(wrong.state.additionalSeenInputs).toEqual([requireInput(raw)]);
    expect(initial.additionalSeenInputs).toBe(undefined);
    const trained = teachExample(wrong.state, {
      input: draft(),
      proposedAnswer: answer('3', '10'),
    }).state;
    const verification = beginVerification(trained).state;
    expect(
      verification.verification.map((question) => verificationScenario(question.input)),
    ).toEqual(['different-positive', 'same-positive', 'zero']);
    expect(
      verification.verification.some((question) =>
        sameChanceInput(question.input, requireInput(raw)),
      ),
    ).toBe(false);
    expect('additionalSeenInputs' in resetSession()).toBe(false);
  });

  it('records only legitimate teaching-stage input exposure and deduplicates repeated rejected submissions', () => {
    const raw = draft('2', '3');
    const wrongStage = teachExample(createSession(), {
      input: raw,
      proposedAnswer: answer('0'),
    });
    expect(wrongStage.feedback.code).toBe('invalid-stage');
    expect(wrongStage.state.additionalSeenInputs).toBe(undefined);
    const first = teachExample(teachingState(), {
      input: raw,
      proposedAnswer: answer('3', '0'),
    });
    expect(first.feedback.code).toBe('invalid-input');
    expect(first.state.additionalSeenInputs).toHaveLength(1);
    expect(first.state.evidence).toEqual([]);
    const second = teachExample(first.state, { input: raw, proposedAnswer: answer('0') });
    expect(second.state).toBe(first.state);
    expect(second.state.additionalSeenInputs).toHaveLength(1);
    const malformed = teachExample(first.state, {
      input: draft('11', '1'),
      proposedAnswer: answer('0'),
    });
    expect(malformed.state).toBe(first.state);
    const corrupt: SessionState = { ...teachingState(), candidateRuleIds: [] };
    expect(
      teachExample(corrupt, { input: raw, proposedAnswer: answer('0') }).state
        .additionalSeenInputs,
    ).toBe(undefined);
  });

  it('compares canonical counts and ordered target colors, not just final probabilities', () => {
    expect(sameChanceInput(requireInput(draft('03', '+02')), observationInput)).toBe(
      true,
    );
    expect(
      sameChanceInput(
        { ...observationInput, first: 'blue', second: 'red' },
        observationInput,
      ),
    ).toBe(false);
  });

  it('chooses different-color, same-color, and zero-boundary examples deterministically', () => {
    const state = trainedState();
    const result = beginVerification(state);
    expect(result).toEqual(beginVerification(state));
    expect(
      result.state.verification.map((question) => verificationScenario(question.input)),
    ).toEqual(['different-positive', 'same-positive', 'zero']);
    const seen = [
      observationInput,
      ...state.experiments.map((record) => record.input),
      ...state.evidence.map((record) => record.input),
    ];
    result.state.verification.forEach((question) => {
      expect(seen.some((input) => sameChanceInput(input, question.input))).toBe(false);
      expect(question.robotEvaluation.answer).toEqual(question.correctAnswer);
    });
  });

  it('preserves all three scenarios after each preferred question was previously taught', () => {
    let state = trainedState();
    for (const raw of [
      draft('2', '3'),
      draft('4', '1', 'red', 'red'),
      draft('0', '3', 'red', 'blue'),
    ]) {
      const correct = evaluateRule('correct', requireInput(raw)).answer;
      state = teachExample(state, {
        input: raw,
        proposedAnswer: answer(
          correct.numerator.toString(),
          correct.denominator.toString(),
        ),
      }).state;
    }
    const verification = beginVerification(state).state;
    expect(verification.verification).toHaveLength(3);
    expect(
      verification.verification.map((question) => verificationScenario(question.input)),
    ).toEqual(['different-positive', 'same-positive', 'zero']);
    expect(
      verification.verification.every(
        (question) =>
          !state.evidence.some((record) => sameChanceInput(record.input, question.input)),
      ),
    ).toBe(true);
  });

  it('requires three ordered learner answers and correct robot predictions to complete', () => {
    let state = beginVerification(trainedState()).state;
    expect(answerVerification(state, 'verify-2', answer('1')).feedback.code).toBe(
      'question-order',
    );
    expect(answerVerification(state, 'verify-1', answer('0')).feedback.code).toBe(
      'incorrect-verification',
    );
    expect(answerVerification(state, 'verify-1', answer('3', '0')).feedback.code).toBe(
      'invalid-input',
    );
    const first = state.verification[0];
    if (!first) throw new Error('Expected three questions.');
    const corrupted: SessionState = {
      ...state,
      verification: state.verification.map((question) => ({
        ...question,
        robotEvaluation: { ...question.robotEvaluation, answer: createRational(0n, 1n) },
      })),
    };
    expect(
      answerVerification(
        corrupted,
        first.id,
        answer(
          first.correctAnswer.numerator.toString(),
          first.correctAnswer.denominator.toString(),
        ),
      ).feedback.code,
    ).toBe('robot-verification-failed');
    for (let index = 0; index < 3; index += 1) {
      const question = state.verification[index];
      if (!question) throw new Error('Expected three questions.');
      const correct = question.correctAnswer;
      state = answerVerification(
        state,
        question.id,
        answer(
          (correct.numerator * 2n).toString(),
          (correct.denominator * 2n).toString(),
        ),
      ).state;
      expect(state.stage).toBe(index === 2 ? 'complete' : 'verify');
    }
    expect(state.verificationAnswers.every((record) => record.robotWasCorrect)).toBe(
      true,
    );
    expect(answerVerification(state, first.id, answer('3', '10')).feedback.code).toBe(
      'invalid-stage',
    );
  });
});

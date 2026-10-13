import { describe, expect, it } from 'vitest';

import { areRationalsEqual, createRational } from '../math/rational';
import {
  answerVerification,
  beginHypothesis,
  beginTeaching,
  beginVerification,
  chooseHypothesis,
  createSession,
  evaluateRule,
  explainEvaluation,
  fractionFoxDefinition,
  observationInput,
  parseAddition,
  parseAnswer,
  resetSession,
  runExperiment,
  sameAddition,
  teachExample,
} from './engine';
import type { AdditionInput, DraftAddition, RawFraction, SessionState } from './engine';

function fraction(numerator: number | bigint, denominator: number | bigint): RawFraction {
  return { numerator: numerator.toString(), denominator: denominator.toString() };
}

function draft(a = 1, b = 2, c = 1, d = 3): DraftAddition {
  return { left: fraction(a, b), right: fraction(c, d) };
}

function requireInput(candidate: DraftAddition): AdditionInput {
  const parsed = parseAddition(candidate);
  if (!parsed.ok) throw new Error('The test fixture must be valid.');
  return parsed.value;
}

function experimentState(): SessionState {
  return chooseHypothesis(beginHypothesis(createSession()).state, 'add-both').state;
}

function teachingState(): SessionState {
  const experiment = runExperiment(experimentState(), draft()).state;
  return beginTeaching(experiment).state;
}

function trainedState(): SessionState {
  const first = teachExample(teachingState(), {
    input: draft(1, 2, 1, 2),
    proposedAnswer: fraction(1, 1),
  }).state;
  return teachExample(first, { input: draft(), proposedAnswer: fraction(5, 6) }).state;
}

describe('FractionFox input validation', () => {
  it('preserves entered terms so misconception rules see 2/4, not 1/2', () => {
    const input = requireInput(draft(2, 4, 2, 4));
    expect(input.left).toEqual({ numerator: 2n, denominator: 4n });
    expect(evaluateRule('add-both', input).steps[0]?.parameters).toEqual({
      numerator: '4',
      denominator: '8',
    });
    expect(evaluateRule('keep-first', input).steps[0]?.parameters).toEqual({
      numerator: '4',
      denominator: '4',
    });
  });

  it('accepts signed numerators, zero numerators, and operand bounds', () => {
    expect(parseAddition(draft(-1000, 1000, 0, 1)).ok).toBe(true);
    expect(
      parseAddition({
        left: { numerator: ' +001 ', denominator: ' 2 ' },
        right: fraction(-1, 3),
      }).ok,
    ).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { left: fraction(1, 2) },
    { left: { numerator: 1, denominator: '2' }, right: fraction(1, 3) },
    { left: { numerator: '1.5', denominator: '2' }, right: fraction(1, 3) },
    { left: { numerator: '1e3', denominator: '2' }, right: fraction(1, 3) },
    { left: { numerator: '', denominator: '2' }, right: fraction(1, 3) },
    draft(1, 0),
    draft(1, -2),
    draft(1001, 2),
    draft(-1001, 2),
    draft(1, 1001),
    { left: { numerator: '9'.repeat(1000), denominator: '2' }, right: fraction(1, 3) },
  ])('rejects malformed or unsupported operand %j', (candidate) => {
    expect(parseAddition(candidate).ok).toBe(false);
  });

  it('uses wider answer bounds so valid extreme sums and nonreduced answers are accepted', () => {
    const input = requireInput(draft(1, 1000, 1, 999));
    const answer = evaluateRule('correct', input).answer;
    expect(answer).toEqual({ numerator: 1999n, denominator: 999000n });
    expect(parseAnswer(fraction(1999, 999000))).toEqual({ ok: true, value: answer });
    expect(parseAnswer(fraction(3998, 1998000))).toEqual({ ok: true, value: answer });
    expect(
      teachExample(teachingState(), {
        input: draft(1, 1000, 1, 999),
        proposedAnswer: fraction(1999, 999000),
      }).feedback.kind,
    ).toBe('success');
  });

  it('rejects malformed, zero, negative, and oversized answer denominators', () => {
    expect(parseAnswer({ numerator: '1.0', denominator: '2' }).ok).toBe(false);
    expect(parseAnswer(fraction(1, 0)).ok).toBe(false);
    expect(parseAnswer(fraction(1, -2)).ok).toBe(false);
    expect(parseAnswer(fraction(1_000_000_000_001n, 2)).ok).toBe(false);
    expect(parseAnswer(fraction(1, 1_000_000_000_001n)).ok).toBe(false);
  });

  it('implements the existing generic domain contract with validation and exact equality', () => {
    const validated = fractionFoxDefinition.domain.validateSubmission({
      input: draft(),
      proposedAnswer: fraction(10, 12),
    });
    expect(validated.ok).toBe(true);
    expect(
      fractionFoxDefinition.domain.answersEqual(
        createRational(10n, 12n),
        createRational(5n, 6n),
      ),
    ).toBe(true);
    expect(fractionFoxDefinition.domain.validateSubmission({ input: draft() }).ok).toBe(
      false,
    );
  });
});

describe('deterministic FractionFox rules', () => {
  it('distinguishes the correct rule and both concrete misconceptions', () => {
    expect(evaluateRule('correct', observationInput).answer).toEqual(
      createRational(5n, 6n),
    );
    expect(evaluateRule('add-both', observationInput).answer).toEqual(
      createRational(2n, 5n),
    );
    expect(evaluateRule('keep-first', observationInput).answer).toEqual(
      createRational(1n, 1n),
    );
  });

  it('handles equal denominators, negatives, zero, improper fractions and normalization', () => {
    expect(evaluateRule('correct', requireInput(draft(2, 4, 2, 4))).answer).toEqual(
      createRational(1n, 1n),
    );
    expect(evaluateRule('correct', requireInput(draft(-1, 2, 1, 3))).answer).toEqual(
      createRational(-1n, 6n),
    );
    expect(evaluateRule('correct', requireInput(draft(-1, 2, 1, 2))).answer).toEqual(
      createRational(0n, 1n),
    );
    expect(evaluateRule('correct', requireInput(draft(3, 2, 2, 3))).answer).toEqual(
      createRational(13n, 6n),
    );
  });

  it('returns identical trace and answer without changing entered input', () => {
    const input = requireInput(draft(2, 4, -1, 3));
    const before = structuredClone(input);
    expect(evaluateRule('correct', input)).toEqual(evaluateRule('correct', input));
    expect(input).toEqual(before);
    const explanations = explainEvaluation(evaluateRule('correct', input));
    expect(explanations).toHaveLength(3);
    expect(explanations.join(' ')).toContain('1/6');
    expect(explanations.join(' ').includes('undefined')).toBe(false);
  });
});

describe('five-step teaching session', () => {
  it('starts with a misconception and all candidates, without shortcutting stages', () => {
    const state = createSession();
    expect(state.stage).toBe('observe');
    expect(state.currentRuleId).toBe('add-both');
    expect(state.candidateRuleIds).toEqual(['correct', 'add-both', 'keep-first']);
    expect(beginVerification(state).feedback.code).toBe('invalid-stage');
    expect(beginTeaching(state).state).toBe(state);
    expect(
      teachExample(state, { input: draft(), proposedAnswer: fraction(5, 6) }).state,
    ).toBe(state);
    expect(answerVerification(state, 'verify-1', fraction(5, 6)).state).toBe(state);
  });

  it('records an incorrect hypothesis and explains the mismatch without pruning', () => {
    const hypothesis = beginHypothesis(createSession()).state;
    const selected = chooseHypothesis(hypothesis, 'correct');
    expect(selected.state.hypothesis).toBe('correct');
    expect(selected.state.stage).toBe('experiment');
    expect(selected.feedback.code).toBe('hypothesis-differs');
    expect(selected.state.candidateRuleIds).toEqual(hypothesis.candidateRuleIds);
    expect(chooseHypothesis(hypothesis, 'add-both').feedback.code).toBe(
      'hypothesis-matches',
    );
  });

  it('requires an effective experiment before teaching and records experiment trace', () => {
    const state = experimentState();
    expect(beginTeaching(state).feedback.code).toBe('experiment-required');
    const invalid = runExperiment(state, draft(1, 0));
    expect(invalid.state).toBe(state);
    expect(invalid.feedback.code).toBe('invalid-input');
    const valid = runExperiment(state, draft());
    expect(valid.state.stage).toBe('experiment');
    expect(valid.state.experiments[0]?.robotEvaluation.answer).toEqual(
      createRational(2n, 5n),
    );
    expect(valid.state.experiments[0]?.robotWasCorrect).toBe(false);
    expect(valid.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    expect(beginTeaching(valid.state).state.stage).toBe('teach');
  });

  it('identifies a coincidentally correct experiment without claiming learning', () => {
    const result = runExperiment(experimentState(), draft(0, 2, 0, 3));
    expect(result.state.experiments[0]?.robotWasCorrect).toBe(true);
    expect(result.feedback.message).toContain('碰巧');
    expect(result.state.candidateRuleIds).toHaveLength(3);
  });

  it('never prunes or records evidence for invalid input or an incorrect student answer', () => {
    const state = teachingState();
    const before = structuredClone(state);
    const malformed = teachExample(state, {
      input: draft(),
      proposedAnswer: fraction(1, 0),
    });
    const incorrect = teachExample(state, {
      input: draft(),
      proposedAnswer: fraction(2, 5),
    });
    expect(malformed.state).toBe(state);
    expect(incorrect.state).toBe(state);
    expect(incorrect.feedback.code).toBe('incorrect-example');
    expect(state).toEqual(before);
  });

  it('records a valid but non-discriminating example without removing a candidate', () => {
    const state = teachingState();
    const result = teachExample(state, {
      input: draft(0, 2, 0, 3),
      proposedAnswer: fraction(0, 17),
    });
    expect(result.feedback.code).toBe('non-discriminating');
    expect(result.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    expect(result.state.evidence).toHaveLength(1);
    expect(result.state.evidence[0]?.eliminatedRuleIds).toEqual([]);
    expect(beginVerification(result.state).feedback.code).toBe('teaching-required');
  });

  it('eliminates only incompatible rules, retains reasons, and changes the displayed rule', () => {
    const state = teachingState();
    const first = teachExample(state, {
      input: draft(1, 2, 1, 2),
      proposedAnswer: fraction(2, 2),
    });
    expect(first.state.candidateRuleIds).toEqual(['correct', 'keep-first']);
    expect(first.state.currentRuleId).toBe('keep-first');
    expect(first.state.evidence[0]?.eliminatedRuleIds).toEqual(['add-both']);
    expect(
      first.state.evidence[0]?.comparisons.find((item) => item.ruleId === 'add-both'),
    ).toMatchObject({
      compatible: false,
      evaluation: { answer: createRational(1n, 2n) },
    });
    expect(beginVerification(first.state).feedback.code).toBe('teaching-required');
    const second = teachExample(first.state, {
      input: draft(),
      proposedAnswer: fraction(10, 12),
    });
    expect(second.state.candidateRuleIds).toEqual(['correct']);
    expect(second.state.currentRuleId).toBe('correct');
    expect(second.state.evidence[1]?.eliminatedRuleIds).toEqual(['keep-first']);
    expect(second.state.stage).toBe('teach');
    expect(second.feedback.code).toBe('ready-verification');
    expect(state.evidence).toEqual([]);
  });

  it('rejects empty or inconsistent candidate states instead of inventing completion', () => {
    const state = teachingState();
    const empty: SessionState = { ...state, candidateRuleIds: [] };
    const missingCorrect: SessionState = { ...state, candidateRuleIds: ['add-both'] };
    expect(
      teachExample(empty, { input: draft(), proposedAnswer: fraction(5, 6) }).feedback
        .code,
    ).toBe('inconsistent-state');
    expect(beginVerification(missingCorrect).feedback.code).toBe('inconsistent-state');
    expect(beginVerification(empty).state).toBe(empty);
  });

  it('resets all hypotheses, history, verification answers and stage', () => {
    const progressed = beginVerification(trainedState()).state;
    expect(progressed.evidence.length).toBeGreaterThan(0);
    expect(resetSession()).toEqual(createSession());
    expect(resetSession().evidence).toEqual([]);
    expect(resetSession().verificationAnswers).toEqual([]);
    expect(resetSession() === createSession()).toBe(false);
  });
});

describe('unseen verification and completion', () => {
  it('treats equivalent fractions and swapped addends as the same question', () => {
    expect(
      sameAddition(requireInput(draft(1, 2, 1, 4)), requireInput(draft(2, 8, 2, 4))),
    ).toBe(true);
    expect(
      sameAddition(requireInput(draft(1, 2, 1, 4)), requireInput(draft(1, 2, 1, 5))),
    ).toBe(false);
  });

  it('deterministically generates three distinct questions excluding all seen pairs', () => {
    const experimented = runExperiment(experimentState(), draft(1, 2, 1, 5)).state;
    const teaching = beginTeaching(experimented).state;
    const firstExample = teachExample(teaching, {
      input: draft(1, 2, 1, 2),
      proposedAnswer: fraction(1, 1),
    }).state;
    let state = teachExample(firstExample, {
      input: draft(),
      proposedAnswer: fraction(5, 6),
    }).state;
    state = teachExample(state, {
      input: draft(2, 8, 2, 4),
      proposedAnswer: fraction(3, 4),
    }).state;
    state = teachExample(state, {
      input: draft(0, 2, 0, 3),
      proposedAnswer: fraction(0, 1),
    }).state;
    const first = beginVerification(state);
    const second = beginVerification(state);
    expect(first).toEqual(second);
    expect(first.state.verification).toHaveLength(3);
    expect(first.state.verification[0]?.input.right.denominator).toBe(6n);
    const seen = [
      observationInput,
      ...state.experiments.map((item) => item.input),
      ...state.evidence.map((item) => item.input),
    ];
    first.state.verification.forEach((question, index) => {
      expect(seen.some((input) => sameAddition(input, question.input))).toBe(false);
      expect(
        first.state.verification
          .slice(0, index)
          .some((previous) => sameAddition(previous.input, question.input)),
      ).toBe(false);
      expect(
        areRationalsEqual(question.robotEvaluation.answer, question.correctAnswer),
      ).toBe(true);
    });
    expect(first.state.stage).toBe('verify');
    expect(first.state.verificationAnswers).toEqual([]);
  });

  it('does not accept later questions, repeated questions, wrong or invalid answers', () => {
    const state = beginVerification(trainedState()).state;
    expect(answerVerification(state, 'verify-2', fraction(1, 1)).feedback.code).toBe(
      'question-order',
    );
    expect(answerVerification(state, 'verify-1', fraction(1, 0)).feedback.code).toBe(
      'invalid-input',
    );
    expect(answerVerification(state, 'verify-1', fraction(0, 1)).feedback.code).toBe(
      'incorrect-verification',
    );
    expect(answerVerification(state, 'verify-1', fraction(0, 1)).state).toBe(state);
    const question = state.verification[0];
    if (!question) throw new Error('Expected a verification question.');
    const accepted = answerVerification(
      state,
      question.id,
      fraction(
        question.correctAnswer.numerator * 2n,
        question.correctAnswer.denominator * 2n,
      ),
    );
    expect(accepted.state.verificationAnswers).toHaveLength(1);
    expect(accepted.state.stage).toBe('verify');
    expect(
      answerVerification(
        accepted.state,
        question.id,
        fraction(question.correctAnswer.numerator, question.correctAnswer.denominator),
      ).feedback.code,
    ).toBe('question-order');
  });

  it('requires three learner answers and independently correct robot predictions to complete', () => {
    let state = beginVerification(trainedState()).state;
    for (let index = 0; index < 3; index += 1) {
      const question = state.verification[index];
      if (!question) throw new Error('Expected three verification questions.');
      const answer = evaluateRule('correct', question.input).answer;
      state = answerVerification(
        state,
        question.id,
        fraction(answer.numerator, answer.denominator),
      ).state;
      expect(state.stage).toBe(index === 2 ? 'complete' : 'verify');
    }
    expect(state.candidateRuleIds).toEqual(['correct']);
    expect(state.verificationAnswers.every((answer) => answer.robotWasCorrect)).toBe(
      true,
    );
    expect(answerVerification(state, 'verify-3', fraction(1, 1)).feedback.code).toBe(
      'invalid-stage',
    );
  });

  it('rejects a verification state missing earlier teaching prerequisites', () => {
    const state = beginVerification(trainedState()).state;
    const question = state.verification[0];
    if (!question) throw new Error('Expected a verification question.');
    const corruptedStates: readonly SessionState[] = [
      { ...state, evidence: [] },
      { ...state, experiments: [] },
      { ...state, hypothesis: null },
    ];
    const answer = fraction(
      question.correctAnswer.numerator,
      question.correctAnswer.denominator,
    );
    corruptedStates.forEach((corrupted) => {
      const result = answerVerification(corrupted, question.id, answer);
      expect(result.feedback.code).toBe('teaching-required');
      expect(result.state).toBe(corrupted);
      expect(result.state.verificationAnswers).toEqual([]);
    });
  });

  it('refuses a stored incorrect robot prediction even if the learner answer is right', () => {
    const state = beginVerification(trainedState()).state;
    const modified: SessionState = {
      ...state,
      verification: state.verification.map((question, index) =>
        index === 0
          ? {
              ...question,
              robotEvaluation: {
                ...question.robotEvaluation,
                answer: createRational(0n, 1n),
              },
            }
          : question,
      ),
    };
    const question = modified.verification[0];
    if (!question) throw new Error('Expected a verification question.');
    const answer = evaluateRule('correct', question.input).answer;
    expect(
      answerVerification(
        modified,
        question.id,
        fraction(answer.numerator, answer.denominator),
      ).feedback.code,
    ).toBe('robot-verification-failed');
    expect(
      answerVerification(
        modified,
        question.id,
        fraction(answer.numerator, answer.denominator),
      ).state,
    ).toBe(modified);
  });
});

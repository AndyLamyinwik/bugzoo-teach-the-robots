import { describe, expect, it } from 'vitest';

import type { ExperimentSubmission, ValidationResult } from '../contracts';
import { createTeachingEngine } from './engine';
import type { SessionState, TeachingEngine, TeachingEngineConfig } from './engine';

type TextRuleId = 'truth' | 'echo' | 'suffix';
type TextState = SessionState<string, string, TextRuleId>;
type TextEngine = TeachingEngine<string, string, TextRuleId>;

function parseText(candidate: unknown): ValidationResult<string> {
  return typeof candidate === 'string' && /^[a-z]+$/i.test(candidate)
    ? { ok: true, value: candidate }
    : { ok: false, issues: [{ code: 'letters', path: [], messageKey: 'text.letters' }] };
}

function validateTextSubmission(
  candidate: unknown,
): ValidationResult<ExperimentSubmission<string, string>> {
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    !('input' in candidate) ||
    !('proposedAnswer' in candidate)
  ) {
    return { ok: false, issues: [{ code: 'shape', path: [], messageKey: 'text.shape' }] };
  }
  const input = parseText(candidate.input);
  const answer = parseText(candidate.proposedAnswer);
  if (!input.ok || !answer.ok) {
    return {
      ok: false,
      issues: [...(!input.ok ? input.issues : []), ...(!answer.ok ? answer.issues : [])],
    };
  }
  return { ok: true, value: { input: input.value, proposedAnswer: answer.value } };
}

/** A text domain proves that shared state logic has no rational-number assumptions. */
function fixtureConfig(
  candidates: readonly string[] = [
    'DEMO',
    'demo',
    'a',
    'A',
    'b',
    'B',
    'fresh',
    'FRESH',
    'later',
    'last',
    'third',
  ],
): TeachingEngineConfig<string, string, TextRuleId> {
  return {
    name: 'TextBot',
    correctId: 'truth',
    orderedRuleIds: ['echo', 'suffix', 'truth'],
    observationInput: 'demo',
    rules: {
      truth: {
        id: 'truth',
        kind: 'correct',
        descriptionKey: 'text.truth',
        evaluate: (input) => ({ answer: input.toUpperCase(), steps: [] }),
      },
      echo: {
        id: 'echo',
        kind: 'misconception',
        descriptionKey: 'text.echo',
        evaluate: (input) => ({ answer: input, steps: [] }),
      },
      suffix: {
        id: 'suffix',
        kind: 'misconception',
        descriptionKey: 'text.suffix',
        evaluate: (input) => ({
          answer: input.startsWith('Z') ? input.toUpperCase() : `${input.toUpperCase()}!`,
          steps: [],
        }),
      },
    },
    parseInput: parseText,
    parseAnswer: parseText,
    validateSubmission: validateTextSubmission,
    answersEqual: (left, right) => left === right,
    sameInput: (left, right) => left.toLowerCase() === right.toLowerCase(),
    verificationCandidates: () => candidates,
    formatAnswer: (answer) => answer,
    validationMessages: {
      'text.letters': 'Only letters are accepted.',
      'text.shape': 'Both fields are required.',
    },
  };
}

function readyToTeach(engine: TextEngine): TextState {
  const hypothesis = engine.beginHypothesis(engine.createSession()).state;
  const guessed = engine.chooseHypothesis(hypothesis, 'echo').state;
  const experiment = engine.runExperiment(guessed, 'fresh').state;
  return engine.beginTeaching(experiment).state;
}

function trained(engine: TextEngine): TextState {
  const first = engine.teachExample(readyToTeach(engine), {
    input: 'A',
    proposedAnswer: 'A',
  }).state;
  return engine.teachExample(first, { input: 'b', proposedAnswer: 'B' }).state;
}

describe('shared teaching engine', () => {
  it('uses configured rule priority while preserving correct-first candidate records', () => {
    const engine = createTeachingEngine(fixtureConfig());
    const initial = engine.createSession();
    expect(initial.candidateRuleIds).toEqual(['truth', 'echo', 'suffix']);
    expect(initial.currentRuleId).toBe('echo');
    const taught = engine.teachExample(readyToTeach(engine), {
      input: 'a',
      proposedAnswer: 'A',
    });
    expect(taught.state.currentRuleId).toBe('truth');
    expect(taught.state.evidence[0]?.comparisons.map((item) => item.ruleId)).toEqual([
      'truth',
      'echo',
      'suffix',
    ]);
    expect(taught.state.evidence[0]?.eliminatedRuleIds).toEqual(['echo', 'suffix']);
    expect(taught.state.stage).toBe('teach');
  });

  it('validates rule configuration before constructing a lesson', () => {
    const config = fixtureConfig();
    expect(() =>
      createTeachingEngine({ ...config, orderedRuleIds: ['echo', 'echo', 'truth'] }),
    ).toThrow();
    expect(() =>
      createTeachingEngine({ ...config, orderedRuleIds: ['truth', 'echo', 'suffix'] }),
    ).toThrow();
    expect(() =>
      createTeachingEngine({ ...config, orderedRuleIds: ['echo', 'truth'] }),
    ).toThrow();
    expect(() =>
      createTeachingEngine({
        ...config,
        rules: {
          ...config.rules,
          truth: { ...config.rules.truth, kind: 'misconception' },
        },
      }),
    ).toThrow();
  });

  it('keeps factory instances, simultaneous sessions, and old states independent', () => {
    const firstEngine = createTeachingEngine(fixtureConfig());
    const secondEngine = createTeachingEngine({
      ...fixtureConfig(),
      name: 'OtherTextBot',
    });
    const firstInitial = firstEngine.createSession();
    const secondInitial = secondEngine.createSession();
    const anotherSession = firstEngine.createSession();
    const before = structuredClone(firstInitial);
    const progressed = firstEngine.beginHypothesis(firstInitial).state;
    expect(progressed.stage).toBe('hypothesize');
    expect(firstInitial).toEqual(before);
    expect(secondInitial.stage).toBe('observe');
    expect(anotherSession.stage).toBe('observe');
    expect(firstInitial === anotherSession).toBe(false);
    expect(firstInitial.evidence === anotherSession.evidence).toBe(false);
    expect(firstEngine.resetSession()).toEqual(firstInitial);
    expect(secondEngine.beginHypothesis(secondInitial).feedback.message).toContain(
      'OtherTextBot',
    );
    expect(firstEngine.beginHypothesis(firstInitial).feedback.message).toContain(
      'TextBot',
    );
  });

  it('shares invalid-input, incorrect-evidence and non-discriminating behavior without mutation', () => {
    const engine = createTeachingEngine(fixtureConfig());
    const state = readyToTeach(engine);
    expect(
      engine.teachExample(state, { input: 'a', proposedAnswer: 'wrong' }).state,
    ).toBe(state);
    const invalid = engine.teachExample(state, { input: 1, proposedAnswer: 'A' });
    expect(invalid.state).toBe(state);
    expect(invalid.feedback.message).toBe('Only letters are accepted.');
    expect(invalid.feedback.issues?.[0]?.messageKey).toBe('text.letters');
    const accepted = engine.teachExample(state, { input: 'Z', proposedAnswer: 'Z' });
    expect(accepted.feedback.code).toBe('non-discriminating');
    expect(accepted.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    expect(accepted.state.evidence).toHaveLength(1);
    expect(state.evidence).toEqual([]);
  });

  it('uses domain identity to exclude observations, experiments, evidence and duplicate candidates', () => {
    const engine = createTeachingEngine(fixtureConfig());
    const state = trained(engine);
    expect(engine.isReadyForVerification(state)).toBe(true);
    const verification = engine.beginVerification(state);
    expect(verification.state.verification.map((question) => question.input)).toEqual([
      'later',
      'last',
      'third',
    ]);
    expect(engine.beginVerification(state)).toEqual(verification);
    expect(verification.state.verificationAnswers).toEqual([]);
    expect(verification.state.stage).toBe('verify');
  });

  it('reports an exhausted finite question pool without fabricating unseen examples', () => {
    const engine = createTeachingEngine(
      fixtureConfig(['demo', 'fresh', 'A', 'b', 'later', 'LATER']),
    );
    const state = trained(engine);
    const verification = engine.beginVerification(state);
    expect(verification.feedback.code).toBe('verification-unavailable');
    expect(verification.state).toBe(state);
    expect(verification.state.verification).toEqual([]);
  });

  it('requires in-order learner answers plus robot correctness before completing a different domain', () => {
    const engine = createTeachingEngine(fixtureConfig());
    let state = engine.beginVerification(trained(engine)).state;
    expect(engine.answerVerification(state, 'verify-2', 'LAST').feedback.code).toBe(
      'question-order',
    );
    expect(engine.answerVerification(state, 'verify-1', 'wrong').state).toBe(state);
    for (const question of state.verification) {
      state = engine.answerVerification(
        state,
        question.id,
        question.input.toUpperCase(),
      ).state;
    }
    expect(state.stage).toBe('complete');
    expect(state.verificationAnswers).toHaveLength(3);
    expect(state.verificationAnswers.every((answer) => answer.robotWasCorrect)).toBe(
      true,
    );
    expect(engine.resetSession().stage).toBe('observe');
    expect(engine.resetSession().verificationAnswers).toEqual([]);
  });

  it('preserves completion guards for corrupted generic states', () => {
    const engine = createTeachingEngine(fixtureConfig());
    const state = engine.beginVerification(trained(engine)).state;
    const missingEvidence = { ...state, evidence: [] };
    expect(engine.isReadyForVerification(missingEvidence)).toBe(false);
    expect(
      engine.answerVerification(missingEvidence, 'verify-1', 'LATER').feedback.code,
    ).toBe('teaching-required');
    const corrupted: TextState = {
      ...state,
      verification: state.verification.map((question) => ({
        ...question,
        robotEvaluation: { answer: 'wrong', steps: [] },
      })),
    };
    expect(engine.answerVerification(corrupted, 'verify-1', 'LATER').feedback.code).toBe(
      'robot-verification-failed',
    );
    expect(engine.answerVerification(corrupted, 'verify-1', 'LATER').state).toBe(
      corrupted,
    );
  });
});

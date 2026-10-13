import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as mole from '../domain/minusMole/engine';
import * as fox from '../domain/fractionFox/engine';
import * as panda from '../domain/discountPanda/engine';
import { MinusMoleGame } from '../features/minusMole/MinusMoleGame';
import { App } from './App';
import { lessonLinks, resolveLessonRoute } from './routes';

describe('MinusMole homepage and shared teaching integration', () => {
  it('connects the real home entry and skip fragment to the genuine initial lesson', () => {
    const home = renderToStaticMarkup(createElement(App));
    expect(home).toContain(`href="${lessonLinks.minusmole}"`);
    expect(resolveLessonRoute(lessonLinks.minusmole)).toBe('minusmole');
    expect(resolveLessonRoute('#minusmole-content')).toBe('minusmole');
    expect(resolveLessonRoute('#chancecrow')).toBe('chancecrow');
    expect(resolveLessonRoute('#unknown-lesson')).toBe('home');
    const lesson = renderToStaticMarkup(createElement(MinusMoleGame));
    expect(lesson).toContain('五步驟關卡進度');
    expect(lesson).toContain('minusmole-content');
    expect(lesson).toContain('MinusMole');
    expect(
      mole.evaluateRule(mole.createSession().currentRuleId, mole.observationInput).answer,
    ).toBe(2n);
    expect(mole.evaluateRule('correct', mole.observationInput).answer).toBe(8n);
  });

  it('takes the home lesson through evidence, retry and three genuine unseen answers', () => {
    expect(resolveLessonRoute(lessonLinks.minusmole)).toBe('minusmole');
    let state = mole.createSession();
    state = mole.beginHypothesis(state).state;
    state = mole.chooseHypothesis(state, 'subtract-absolute').state;
    state = mole.runExperiment(state, { a: '2', b: '-7' }).state;
    expect(state.experiments[0]?.robotEvaluation.answer).toBe(-5n);
    expect(state.experiments[0]?.correctAnswer).toBe(9n);
    state = mole.beginTeaching(state).state;
    const ambiguous = mole.teachExample(state, {
      input: { a: '5', b: '3' },
      proposedAnswer: '2',
    });
    expect(ambiguous.feedback.code).toBe('non-discriminating');
    expect(ambiguous.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    state = ambiguous.state;
    const wrong = mole.teachExample(state, {
      input: { a: '-5', b: '-3' },
      proposedAnswer: '2',
    });
    expect(wrong.state).toBe(state);
    state = mole.teachExample(state, {
      input: { a: '-5', b: '-3' },
      proposedAnswer: '-2',
    }).state;
    expect(state.candidateRuleIds).toEqual(['correct']);
    expect(
      state.evidence.filter((record) => record.eliminatedRuleIds.length > 0),
    ).toHaveLength(1);
    state = mole.beginVerification(state).state;
    expect(
      state.verification.map((question) => mole.signScenario(question.input)),
    ).toEqual([
      'positive-minus-negative',
      'negative-minus-positive',
      'negative-minus-negative',
    ]);
    const expected = ['9', '-7', '5'];
    for (const [index, question] of state.verification.entries()) {
      expect(
        [...state.experiments, ...state.evidence].some((record) =>
          mole.sameSubtractionInput(record.input, question.input),
        ),
      ).toBe(false);
      expect(mole.answerVerification(state, question.id, '40').state).toBe(state);
      expect(question.robotEvaluation.answer.toString()).toBe(expected[index]);
      state = mole.answerVerification(state, question.id, expected[index]).state;
      expect(state.stage).toBe(index === 2 ? 'complete' : 'verify');
    }
    expect(state.verificationAnswers.every((answer) => answer.robotWasCorrect)).toBe(
      true,
    );
    expect(mole.resetSession()).toEqual(mole.createSession());
    expect(mole.resetSession().evidence).toHaveLength(0);
  });

  it('does not share mutable candidates or histories with the first two lessons', () => {
    const foxState = fox.createSession();
    const pandaState = panda.createSession();
    const initial = mole.createSession();
    let taught = mole.chooseHypothesis(
      mole.beginHypothesis(initial).state,
      'subtract-absolute',
    ).state;
    taught = mole.runExperiment(taught, { a: '-5', b: '-3' }).state;
    taught = mole.beginTeaching(taught).state;
    taught = mole.teachExample(taught, {
      input: { a: '-5', b: '-3' },
      proposedAnswer: '-2',
    }).state;
    expect(taught.currentRuleId).toBe('correct');
    expect(initial).toEqual(mole.createSession());
    expect(foxState).toEqual(fox.createSession());
    expect(pandaState).toEqual(panda.createSession());
    expect(fox.evaluateRule(foxState.currentRuleId, fox.observationInput).answer).toEqual(
      { numerator: 2n, denominator: 5n },
    );
    expect(
      panda.evaluateRule(pandaState.currentRuleId, panda.observationInput).answer,
    ).toBe(7000n);
  });
});

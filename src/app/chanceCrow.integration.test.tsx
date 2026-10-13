import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as crow from '../domain/chanceCrow/engine';
import * as fox from '../domain/fractionFox/engine';
import * as panda from '../domain/discountPanda/engine';
import * as mole from '../domain/minusMole/engine';
import { createRational, areRationalsEqual } from '../domain/math/rational';
import { ChanceCrowGame } from '../features/chanceCrow/ChanceCrowGame';
import { App } from './App';
import { lessonLinks, resolveLessonRoute } from './routes';

const observationDraft = {
  red: '3',
  blue: '2',
  first: 'red',
  second: 'blue',
} as const;

describe('ChanceCrow homepage and teaching integration', () => {
  it('connects all four real home entries and the Crow skip fragment', () => {
    const home = renderToStaticMarkup(createElement(App));
    for (const [route, link] of Object.entries(lessonLinks)) {
      expect(home).toContain(`href="${link}"`);
      expect(resolveLessonRoute(link)).toBe(route);
    }
    expect(home.includes('即將推出')).toBe(false);
    expect(resolveLessonRoute('#chancecrow-content')).toBe('chancecrow');
    const lesson = renderToStaticMarkup(createElement(ChanceCrowGame));
    expect(lesson).toContain('chancecrow-content');
    expect(lesson).toContain('五步驟關卡進度');
    expect(lesson).toContain('ChanceCrow');
    expect(
      crow.evaluateRule(crow.createSession().currentRuleId, crow.observationInput).answer,
    ).toEqual(createRational(6n, 25n));
    expect(crow.evaluateRule('correct', crow.observationInput).answer).toEqual(
      createRational(3n, 10n),
    );
  });

  it('teaches from an impossible first event and an equivalent fraction, then completes all unseen contexts', () => {
    let state = crow.createSession();
    state = crow.beginHypothesis(state).state;
    state = crow.chooseHypothesis(state, 'independent').state;
    state = crow.runExperiment(state, observationDraft).state;
    expect(state.experiments[0]?.robotWasCorrect).toBe(false);
    state = crow.beginTeaching(state).state;
    const indistinguishable = crow.teachExample(state, {
      input: { red: '3', blue: '0', first: 'blue', second: 'blue' },
      proposedAnswer: { numerator: '0', denominator: '1' },
    });
    expect(indistinguishable.feedback.code).toBe('non-discriminating');
    expect(indistinguishable.state.candidateRuleIds).toEqual(state.candidateRuleIds);
    state = indistinguishable.state;
    expect(
      crow.teachExample(state, {
        input: observationDraft,
        proposedAnswer: { numerator: '6', denominator: '25' },
      }).state,
    ).toBe(state);
    state = crow.teachExample(state, {
      input: { red: '0', blue: '2', first: 'red', second: 'blue' },
      proposedAnswer: { numerator: '0', denominator: '11' },
    }).state;
    expect(state.candidateRuleIds).toEqual(['correct', 'independent']);
    state = crow.teachExample(state, {
      input: observationDraft,
      proposedAnswer: { numerator: '6', denominator: '20' },
    }).state;
    expect(state.candidateRuleIds).toEqual(['correct']);
    state = crow.beginVerification(state).state;
    expect(state.verification).toHaveLength(3);
    const [different, same, zero] = state.verification;
    expect(different?.input.first === different?.input.second).toBe(false);
    expect(different?.correctAnswer.numerator).toBeGreaterThan(0n);
    expect(same?.input.first).toBe(same?.input.second);
    expect(same?.correctAnswer.numerator).toBeGreaterThan(0n);
    expect(zero?.correctAnswer.numerator).toBe(0n);
    for (const [index, question] of state.verification.entries()) {
      const seen = [...state.experiments, ...state.evidence];
      expect(
        seen.some(
          (record) =>
            record.input.red === question.input.red &&
            record.input.blue === question.input.blue &&
            record.input.first === question.input.first &&
            record.input.second === question.input.second,
        ),
      ).toBe(false);
      const { red, blue, first, second } = question.input;
      const total = red + blue;
      const firstCount = first === 'red' ? red : blue;
      const secondCount = (second === 'red' ? red : blue) - (first === second ? 1n : 0n);
      const expected =
        firstCount === 0n
          ? createRational(0n, 1n)
          : createRational(firstCount * secondCount, total * (total - 1n));
      expect(areRationalsEqual(question.robotEvaluation.answer, expected)).toBe(true);
      expect(
        crow.answerVerification(state, question.id, { numerator: '1', denominator: '0' })
          .state,
      ).toBe(state);
      state = crow.answerVerification(state, question.id, {
        numerator: expected.numerator.toString(),
        denominator: expected.denominator.toString(),
      }).state;
      expect(state.stage).toBe(index === 2 ? 'complete' : 'verify');
    }
    expect(state.verificationAnswers.every((answer) => answer.robotWasCorrect)).toBe(
      true,
    );
    expect(crow.resetSession()).toEqual(crow.createSession());
  });

  it('keeps four lesson sessions and their initial mathematical behavior independent', () => {
    const foxState = fox.createSession(),
      pandaState = panda.createSession(),
      moleState = mole.createSession(),
      crowState = crow.createSession();
    let changed = crow.chooseHypothesis(
      crow.beginHypothesis(crowState).state,
      'independent',
    ).state;
    changed = crow.runExperiment(changed, observationDraft).state;
    changed = crow.beginTeaching(changed).state;
    changed = crow.teachExample(changed, {
      input: observationDraft,
      proposedAnswer: { numerator: '3', denominator: '10' },
    }).state;
    expect(changed.currentRuleId).toBe('correct');
    expect(crowState).toEqual(crow.createSession());
    expect(foxState).toEqual(fox.createSession());
    expect(pandaState).toEqual(panda.createSession());
    expect(moleState).toEqual(mole.createSession());
    expect(fox.evaluateRule(foxState.currentRuleId, fox.observationInput).answer).toEqual(
      createRational(2n, 5n),
    );
    expect(
      panda.evaluateRule(pandaState.currentRuleId, panda.observationInput).answer,
    ).toBe(7000n);
    expect(mole.evaluateRule(moleState.currentRuleId, mole.observationInput).answer).toBe(
      2n,
    );
  });
});

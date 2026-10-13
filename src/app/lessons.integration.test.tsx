import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as fox from '../domain/fractionFox/engine';
import * as panda from '../domain/discountPanda/engine';
import { FractionFoxGame } from '../features/fractionFox/FractionFoxGame';
import { DiscountPandaGame } from '../features/discountPanda/DiscountPandaGame';
import { App } from './App';
import { lessonLinks, resolveLessonRoute } from './routes';

function homeLessonRoute(hash: string) {
  const html = renderToStaticMarkup(createElement(App));
  expect(html).toContain(`href="${hash}"`);
  return resolveLessonRoute(hash);
}

describe('homepage and independent lesson integration', () => {
  it('exposes all four implemented lessons on the homepage', () => {
    expect(homeLessonRoute(lessonLinks.fractionfox)).toBe('fractionfox');
    expect(homeLessonRoute(lessonLinks.discountpanda)).toBe('discountpanda');
    expect(homeLessonRoute(lessonLinks.minusmole)).toBe('minusmole');
    expect(homeLessonRoute(lessonLinks.chancecrow)).toBe('chancecrow');
    const html = renderToStaticMarkup(createElement(App));
    expect(html.includes('即將推出')).toBe(false);
    expect(resolveLessonRoute('#fractionfox-content')).toBe('fractionfox');
    expect(resolveLessonRoute('#discountpanda-content')).toBe('discountpanda');
    expect(resolveLessonRoute('#minusmole-content')).toBe('minusmole');
    expect(resolveLessonRoute('#chancecrow-content')).toBe('chancecrow');
  });

  it.each([
    { component: FractionFoxGame, name: 'FractionFox', initialAnswer: '5 分之 2' },
    { component: DiscountPandaGame, name: 'DiscountPanda', initialAnswer: '70.00' },
  ])(
    'renders $name with the shared five steps and its genuine initial rule answer',
    ({ component, name, initialAnswer }) => {
      const html = renderToStaticMarkup(createElement(component));
      expect(html).toContain(name);
      expect(html).toContain('五步驟關卡進度');
      expect(html).toContain('Observe');
      expect(html).toContain('Verify');
      expect(html).toContain(initialAnswer);
      expect(html).toContain('候選規則');
    },
  );

  it('takes the FractionFox home route through gradual teaching and all three transfer answers', () => {
    expect(homeLessonRoute(lessonLinks.fractionfox)).toBe('fractionfox');
    const input = {
      left: { numerator: '1', denominator: '2' },
      right: { numerator: '1', denominator: '3' },
    };
    let state = fox.createSession();
    state = fox.beginHypothesis(state).state;
    state = fox.chooseHypothesis(state, 'add-both').state;
    state = fox.runExperiment(state, input).state;
    state = fox.beginTeaching(state).state;
    state = fox.teachExample(state, {
      input: { ...input, right: input.left },
      proposedAnswer: { numerator: '1', denominator: '1' },
    }).state;
    expect(state.candidateRuleIds).toEqual(['correct', 'keep-first']);
    state = fox.teachExample(state, {
      input,
      proposedAnswer: { numerator: '5', denominator: '6' },
    }).state;
    state = fox.beginVerification(state).state;
    const expectedAnswers = [
      { numerator: '3', denominator: '4' },
      { numerator: '7', denominator: '10' },
      { numerator: '2', denominator: '3' },
    ];
    for (const [index, question] of state.verification.entries()) {
      state = fox.answerVerification(state, question.id, expectedAnswers[index]).state;
      if (index < 2) expect(state.stage).toBe('verify');
    }
    expect(state.stage).toBe('complete');
    expect(state.verificationAnswers).toHaveLength(3);
    expect(state.verificationAnswers.every((answer) => answer.robotWasCorrect)).toBe(
      true,
    );
  });

  it('takes the DiscountPanda home route to completion without changing an existing fox session', () => {
    expect(homeLessonRoute(lessonLinks.discountpanda)).toBe('discountpanda');
    const foxSession = fox.chooseHypothesis(
      fox.beginHypothesis(fox.createSession()).state,
      'keep-first',
    ).state;
    const before = structuredClone(foxSession);
    const input = { price: '100', firstDiscount: '20', secondDiscount: '10' };
    let state = panda.createSession();
    state = panda.beginHypothesis(state).state;
    state = panda.chooseHypothesis(state, 'add-discounts').state;
    state = panda.runExperiment(state, input).state;
    state = panda.beginTeaching(state).state;
    state = panda.teachExample(state, {
      input: { ...input, secondDiscount: '0' },
      proposedAnswer: '80.00',
    }).state;
    expect(state.candidateRuleIds).toEqual(['correct', 'add-discounts']);
    state = panda.teachExample(state, { input, proposedAnswer: '72.00' }).state;
    state = panda.beginVerification(state).state;
    // Independently calculated prices: 125×0.85×0.75; 199.99×0.6667×0.875; 85×0.60×0.825.
    const expectedAnswers = ['79.69', '116.67', '42.08'];
    for (const [index, question] of state.verification.entries()) {
      state = panda.answerVerification(state, question.id, expectedAnswers[index]).state;
      if (index < 2) expect(state.stage).toBe('verify');
    }
    expect(state.stage).toBe('complete');
    expect(state.verificationAnswers).toHaveLength(3);
    expect(foxSession).toEqual(before);
    expect(foxSession.candidateRuleIds).toEqual(['correct', 'add-both', 'keep-first']);
    expect(panda.resetSession()).toEqual(panda.createSession());
  });
});

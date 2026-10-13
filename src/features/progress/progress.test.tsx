import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as fox from '../../domain/fractionFox/engine';
import * as panda from '../../domain/discountPanda/engine';
import { I18nProvider } from '../../i18n';
import { createProgressStore, lessonStorageKey } from '../../progress';
import type { ProgressStorage } from '../../progress';
import { LearningPassport } from './LearningPassport';
import { ProgressDashboard } from './ProgressDashboard';
import { createLearningMarkdown } from './markdownExport';
import {
  earnedAchievements,
  eliminatedMisconceptions,
  summarizeProgress,
} from './progressModel';

function memoryStorage(): ProgressStorage & { readonly entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

const foxInput = {
  left: { numerator: '1', denominator: '2' },
  right: { numerator: '1', denominator: '3' },
};

function teachFox(): fox.SessionState {
  let state = fox.beginHypothesis(fox.createSession()).state;
  state = fox.chooseHypothesis(state, 'add-both').state;
  state = fox.runExperiment(state, foxInput).state;
  state = fox.beginTeaching(state).state;
  state = fox.teachExample(state, {
    input: {
      left: { numerator: '0', denominator: '1' },
      right: { numerator: '0', denominator: '1' },
    },
    proposedAnswer: { numerator: '0', denominator: '1' },
  }).state;
  state = fox.teachExample(state, {
    input: { ...foxInput, right: foxInput.left },
    proposedAnswer: { numerator: '1', denominator: '1' },
  }).state;
  return fox.teachExample(state, {
    input: foxInput,
    proposedAnswer: { numerator: '5', denominator: '6' },
  }).state;
}

function completeFox(): fox.SessionState {
  let state = fox.beginVerification(teachFox()).state;
  const answers = [
    { numerator: '3', denominator: '4' },
    { numerator: '7', denominator: '10' },
    { numerator: '2', denominator: '3' },
  ];
  for (const [index, question] of state.verification.entries()) {
    state = fox.answerVerification(state, question.id, answers[index]).state;
  }
  expect(state.stage).toBe('complete');
  return state;
}

describe('dashboard and learning passport use validated, independent lesson progress', () => {
  it('counts actual rule-changing examples without promoting completed teaching to an achievement', () => {
    const store = createProgressStore(memoryStorage());
    const state = teachFox();
    expect(state.evidence).toHaveLength(3);
    expect(state.evidence[0]?.eliminatedRuleIds).toEqual([]);
    store.save('fractionfox', state);
    store.save('discountpanda', panda.beginHypothesis(panda.createSession()).state);
    const summaries = store.getSummaries();
    expect(summarizeProgress(summaries)).toEqual({
      completed: 0,
      inProgress: 2,
      effectiveExamples: 2,
      verified: 0,
    });
    expect(earnedAchievements(summaries)).toEqual([]);
    const foxSummary = summaries.find((lesson) => lesson.lessonId === 'fractionfox');
    if (!foxSummary) throw new Error('Expected a FractionFox summary');
    expect(eliminatedMisconceptions(foxSummary, 'en')).toEqual([
      'Add both numerators and denominators',
      'Add numerators and keep the first denominator',
    ]);
  });

  it('awards only a genuinely completed lesson and removes that achievement immediately after reset', () => {
    const storage = memoryStorage();
    storage.entries.set('bugzoo.locale.v1', 'en');
    const store = createProgressStore(storage);
    store.save('fractionfox', completeFox());
    store.save('discountpanda', panda.beginHypothesis(panda.createSession()).state);
    const before = store.getSummaries();
    expect(earnedAchievements(before)).toEqual(['fractionfox']);
    expect(summarizeProgress(before)).toEqual({
      completed: 1,
      inProgress: 1,
      effectiveExamples: 2,
      verified: 1,
    });
    let updates = 0;
    const unsubscribe = store.subscribe(() => {
      updates++;
    });
    store.resetLesson('fractionfox');
    expect(updates).toBe(1);
    expect(earnedAchievements(store.getSummaries())).toEqual([]);
    expect(store.getSnapshot('discountpanda').state.stage).toBe('hypothesize');
    store.resetAll();
    expect(summarizeProgress(store.getSummaries())).toEqual({
      completed: 0,
      inProgress: 0,
      effectiveExamples: 0,
      verified: 0,
    });
    expect(storage.entries.get('bugzoo.locale.v1')).toBe('en');
    expect(storage.entries.has(lessonStorageKey('fractionfox'))).toBe(false);
    unsubscribe();
  });

  it('does not issue an achievement after only two of three unseen answers', () => {
    const store = createProgressStore(memoryStorage());
    let state = fox.beginVerification(teachFox()).state;
    const first = state.verification[0];
    const second = state.verification[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second)
      throw new Error('Expected three unseen verification questions');
    state = fox.answerVerification(state, first.id, {
      numerator: '3',
      denominator: '4',
    }).state;
    state = fox.answerVerification(state, second.id, {
      numerator: '7',
      denominator: '10',
    }).state;
    store.save('fractionfox', state);
    const summaries = store.getSummaries();
    expect(summaries[0]?.verificationPassed).toBe(2);
    expect(earnedAchievements(summaries)).toEqual([]);
    expect(summarizeProgress(summaries).verified).toBe(0);
  });

  it('exports real counts, actual eliminated rules, all four concepts, and only earned achievements in the selected language', () => {
    const store = createProgressStore(memoryStorage());
    store.save('fractionfox', completeFox());
    store.save('discountpanda', panda.beginHypothesis(panda.createSession()).state);
    const date = new Date('2026-10-13T12:00:00Z');
    const english = createLearningMarkdown(store.getSummaries(), 'en', date);
    expect(english).toContain('# BugZoo Learning Passport');
    expect(english).toContain('Export date: October 13, 2026');
    expect(english).toContain('Completed lessons: 1 / 4');
    expect(english).toContain('Effective counterexamples: 2');
    expect(english).toContain('Student and robot both passed (3 / 3)');
    expect(english).toContain('No misconceptions have been ruled out yet.');
    expect(english).toContain('FractionFox: Common-unit explainer');
    expect(english).toContain('You and FractionFox both passed three unseen questions.');
    expect(
      english.includes('You and DiscountPanda both passed three unseen questions.'),
    ).toBe(false);
    expect(english.includes('DiscountPanda: Discount-base tracker')).toBe(false);
    expect(english).toContain('3/5 × 2/4 = 3/10');
    expect(/[\u3400-\u9fff]/.test(english)).toBe(false);
    for (const name of ['FractionFox', 'DiscountPanda', 'MinusMole', 'ChanceCrow'])
      expect(english).toContain(`### ${name}`);
    const chinese = createLearningMarkdown(store.getSummaries(), 'zh-TW', date);
    expect(chinese).toContain('# BugZoo 學習護照');
    expect(chinese).toContain('已完成課程: 1 / 4');
    expect(chinese).toContain('有效反例: 2');
    expect(chinese).toContain('FractionFox: 相同單位的解說員');
    expect(chinese).toContain('讓牠採用通分後相加的規則；你與牠都通過了三道未見題。');
    expect(chinese.includes('Common-unit explainer')).toBe(false);
  });

  it('exports truthful zero totals after storage removal fails and the session is cleared only in memory', () => {
    const storage = memoryStorage();
    const store = createProgressStore(storage);
    store.save('fractionfox', completeFox());
    const previous = storage.entries.get(lessonStorageKey('fractionfox'));
    storage.removeItem = () => {
      throw new Error('Storage blocked');
    };
    store.resetLesson('fractionfox');
    expect(store.getSnapshot('fractionfox').saveStatus).toBe('memory-only');
    expect(storage.entries.get(lessonStorageKey('fractionfox'))).toBe(previous);
    const markdown = createLearningMarkdown(
      store.getSummaries(),
      'en',
      new Date('2026-10-13T12:00:00Z'),
    );
    expect(markdown).toContain('Completed lessons: 0 / 4');
    expect(markdown).toContain('Complete a lesson to earn its achievement here.');
    expect(markdown.includes('FractionFox: Common-unit explainer')).toBe(false);
  });

  it.each(['zh-TW', 'en'] as const)(
    'renders all four initial lesson records and no unearned achievement mark in %s',
    (locale) => {
      const dashboard = renderToStaticMarkup(
        createElement(I18nProvider, {
          locale,
          children: createElement(ProgressDashboard),
        }),
      );
      const passport = renderToStaticMarkup(
        createElement(I18nProvider, {
          locale,
          children: createElement(LearningPassport),
        }),
      );
      for (const name of ['FractionFox', 'DiscountPanda', 'MinusMole', 'ChanceCrow']) {
        expect(dashboard).toContain(name);
        expect(passport).toContain(name);
      }
      expect(passport.includes('progress-achievement-mark')).toBe(false);
      expect(passport.includes('progress-achievement-description')).toBe(false);
      expect(dashboard).toContain('href="#fractionfox"');
      expect(dashboard).toContain('href="#passport"');
      expect(passport).toContain('href="#progress"');
      expect(passport).toContain(
        locale === 'en' ? 'Export Markdown learning passport' : '匯出 Markdown 學習護照',
      );
      if (locale === 'en') {
        expect(/[\u3400-\u9fff]/.test(dashboard)).toBe(false);
        expect(/[\u3400-\u9fff]/.test(passport)).toBe(false);
      }
    },
  );
});

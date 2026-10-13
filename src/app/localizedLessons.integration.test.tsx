import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlobalNavigation } from '../components/GlobalNavigation';
import { ChanceCrowGame } from '../features/chanceCrow/ChanceCrowGame';
import { DiscountPandaGame } from '../features/discountPanda/DiscountPandaGame';
import { FractionFoxGame } from '../features/fractionFox/FractionFoxGame';
import { HomePage } from '../features/home/HomePage';
import { MinusMoleGame } from '../features/minusMole/MinusMoleGame';
import { I18nProvider } from '../i18n';
import { lessonLinks, resolveLessonRoute } from './routes';

describe('localized navigation and unchanged lesson observations', () => {
  it('resolves progress and passport without weakening existing lesson fragments', () => {
    expect(resolveLessonRoute('#progress')).toBe('progress');
    expect(resolveLessonRoute('#passport')).toBe('passport');
    for (const [id, hash] of Object.entries(lessonLinks)) {
      expect(resolveLessonRoute(hash)).toBe(id);
      expect(resolveLessonRoute(`${hash}-content`)).toBe(id);
    }
    expect(resolveLessonRoute('#unrecognized')).toBe('home');
  });

  it('offers all four lessons and both report destinations with labeled keyboard controls', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale="en">
        <GlobalNavigation route="progress" />
      </I18nProvider>,
    );
    expect(html).toContain('href="#progress" aria-current="page"');
    expect(html).toContain('href="#passport"');
    expect(html).toContain('aria-label="Choose a lesson"');
    expect(html).toContain('aria-label="Interface language"');
    for (const id of Object.keys(lessonLinks)) expect(html).toContain(`value="${id}"`);
  });

  it('translates the home page while retaining the same real course links', () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale="en">
        <HomePage />
      </I18nProvider>,
    );
    expect(/[\u3400-\u9fff]/.test(html)).toBe(false);
    expect(html).toContain('Teach the Wrong Robots');
    for (const hash of Object.values(lessonLinks))
      expect(html).toContain(`href="${hash}"`);
  });

  it.each([
    {
      Component: FractionFoxGame,
      name: 'FractionFox',
      value: '2',
      meaning: 'denominator',
    },
    {
      Component: DiscountPandaGame,
      name: 'DiscountPanda',
      value: '70.00',
      meaning: 'discount',
    },
    { Component: MinusMoleGame, name: 'MinusMole', value: '2', meaning: 'left' },
    {
      Component: ChanceCrowGame,
      name: 'ChanceCrow',
      value: '6/25',
      meaning: 'replacement',
    },
  ])(
    'translates $name observation, reasoning and controls without changing its rule value',
    ({ Component, name, value, meaning }) => {
      const chinese = renderToStaticMarkup(
        <I18nProvider locale="zh-TW">
          <Component />
        </I18nProvider>,
      );
      const english = renderToStaticMarkup(
        <I18nProvider locale="en">
          <Component />
        </I18nProvider>,
      );
      expect(chinese).toContain(name);
      expect(chinese).toContain(value);
      expect(english).toContain(name);
      expect(english).toContain(value);
      expect(english.toLowerCase()).toContain(meaning);
      expect(/[\u3400-\u9fff]/.test(english)).toBe(false);
      expect(english).toContain('Observe');
      expect(english).toContain('Verify');
    },
  );
});

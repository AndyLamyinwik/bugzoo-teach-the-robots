import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as fox from '../domain/fractionFox/engine';
import { createProgressStore } from '../progress';
import { I18nProvider, useI18n } from './index';
import { createLocaleStore, localeStorageKey } from './localeStore';
import { translate } from './messages';
import type { MessageKey } from './messages';

function Probe() {
  const { locale, t } = useI18n();
  return (
    <output>
      {locale}: {t('核心玩法')}
    </output>
  );
}

describe('typed language messages and safe preference storage', () => {
  it('uses literal message keys and preserves Chinese source text by default', () => {
    const keysAreLiteral: string extends MessageKey ? false : true = true;
    expect(keysAreLiteral).toBe(true);
    expect(
      renderToStaticMarkup(
        <I18nProvider>
          <Probe />
        </I18nProvider>,
      ),
    ).toContain('zh-TW: 核心玩法');
    expect(
      renderToStaticMarkup(
        <I18nProvider locale="en">
          <Probe />
        </I18nProvider>,
      ),
    ).toContain('en:');
    expect(translate('en', '核心玩法') === '核心玩法').toBe(false);
  });

  it('falls back to source text and interpolates exact bigint values in both languages', () => {
    expect(translate('en', 'unregistered {count}', { count: 9007199254740993n })).toBe(
      'unregistered 9007199254740993',
    );
    expect(translate('zh-TW', '還有 {count} 個', { count: 2n })).toBe('還有 2 個');
    expect(translate('en', 'unregistered {missing}')).toBe('unregistered {missing}');
  });

  it('restores a valid preference, immediately publishes changes, and persists for reopening', () => {
    const entries = new Map([[localeStorageKey, 'en']]);
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
    };
    const locale = createLocaleStore(() => storage);
    expect(locale.getSnapshot()).toBe('en');
    const listener = vi.fn();
    const unsubscribe = locale.subscribe(listener);
    locale.setLocale('zh-TW');
    expect(locale.getSnapshot()).toBe('zh-TW');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(createLocaleStore(() => storage).getSnapshot()).toBe('zh-TW');
    unsubscribe();
    locale.setLocale('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'fr', '"en"', 'undefined'])(
    'rejects unsupported preference %j',
    (value) => {
      expect(
        createLocaleStore(() => ({
          getItem: () => value,
          setItem: () => {},
        })).getSnapshot(),
      ).toBe('zh-TW');
    },
  );

  it('keeps language usable when storage getter, read, or write fails', () => {
    for (const source of [
      () => null,
      () => {
        throw new Error('Blocked getter');
      },
      () => ({
        getItem: () => {
          throw new Error('Blocked read');
        },
        setItem: () => {
          throw new Error('Quota');
        },
      }),
    ]) {
      const locale = createLocaleStore(source);
      expect(locale.getSnapshot()).toBe('zh-TW');
      locale.setLocale('en');
      expect(locale.getSnapshot()).toBe('en');
    }
  });

  it('switches language without changing accepted teaching evidence or exact math; reset preserves preference', () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    };
    const progress = createProgressStore(storage);
    const locale = createLocaleStore(() => storage);
    const input = {
      left: { numerator: '1', denominator: '2' },
      right: { numerator: '1', denominator: '3' },
    };
    let state = fox.chooseHypothesis(
      fox.beginHypothesis(fox.createSession()).state,
      'add-both',
    ).state;
    state = fox.runExperiment(state, input).state;
    state = fox.beginTeaching(state).state;
    state = fox.teachExample(state, {
      input,
      proposedAnswer: { numerator: '5', denominator: '6' },
    }).state;
    progress.save('fractionfox', state);
    const before = structuredClone(progress.getSnapshot('fractionfox').state);
    locale.setLocale('en');
    locale.setLocale('zh-TW');
    expect(progress.getSnapshot('fractionfox').state).toEqual(before);
    expect(progress.getSnapshot('fractionfox').state.candidateRuleIds).toEqual([
      'correct',
    ]);
    expect(progress.getSnapshot('fractionfox').state.evidence[0]?.proposedAnswer).toEqual(
      { numerator: 5n, denominator: 6n },
    );
    progress.resetAll();
    expect(entries.get(localeStorageKey)).toBe('zh-TW');
  });
});

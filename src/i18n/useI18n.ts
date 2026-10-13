import { createContext, useContext, useSyncExternalStore } from 'react';
import { localeStore } from './localeStore';
import type { Locale } from './localeStore';
import { translate } from './messages';
import type { Translator } from './messages';

export const LocaleContext = createContext<Locale | null>(null);

export function useI18n(): {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
} {
  const providedLocale = useContext(LocaleContext);
  const savedLocale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );
  const locale = providedLocale ?? savedLocale;
  return {
    locale,
    setLocale: localeStore.setLocale,
    t: (key, values) => translate(locale, key, values),
  };
}

import { useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { localeStore } from './localeStore';
import type { Locale } from './localeStore';
import { LocaleContext } from './useI18n';
import { pageMetadata } from './pageMetadata';

export function I18nProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const savedLocale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );
  const activeLocale = locale ?? savedLocale;
  useEffect(() => {
    document.documentElement.lang = activeLocale;
    function updateMetadata() {
      const metadata = pageMetadata(activeLocale, window.location.hash);
      document.title = metadata.title;
      const values = [
        ['meta[name="description"]', metadata.description],
        ['meta[property="og:title"]', metadata.title],
        ['meta[property="og:description"]', metadata.description],
        ['meta[property="og:locale"]', metadata.ogLocale],
        ['meta[property="og:locale:alternate"]', metadata.alternateLocale],
      ];
      for (const [selector, value] of values) {
        if (selector !== undefined && value !== undefined)
          document.querySelector(selector)?.setAttribute('content', value);
      }
    }
    updateMetadata();
    window.addEventListener('hashchange', updateMetadata);
    return () => window.removeEventListener('hashchange', updateMetadata);
  }, [activeLocale]);
  return <LocaleContext.Provider value={activeLocale}>{children}</LocaleContext.Provider>;
}

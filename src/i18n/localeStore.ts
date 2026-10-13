export type Locale = 'zh-TW' | 'en';
export const localeStorageKey = 'bugzoo.locale.v1';

export interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Locale is a preference; failure to store it never prevents a language change. */
export function createLocaleStore(getStorage: () => LocaleStorage | null) {
  let locale: Locale = 'zh-TW';
  let initialized = false;
  const listeners = new Set<() => void>();
  function getSnapshot(): Locale {
    if (!initialized) {
      initialized = true;
      try {
        const saved = getStorage()?.getItem(localeStorageKey);
        if (saved === 'en' || saved === 'zh-TW') locale = saved;
      } catch {
        // Continue with the in-memory preference when storage is unavailable.
      }
    }
    return locale;
  }
  return {
    getSnapshot,
    getServerSnapshot: (): Locale => 'zh-TW',
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setLocale(next: Locale) {
      initialized = true;
      locale = next;
      try {
        getStorage()?.setItem(localeStorageKey, next);
      } catch {
        /* Memory remains usable. */
      }
      listeners.forEach((listener) => listener());
    },
  };
}

export const localeStore = createLocaleStore(() =>
  typeof window === 'undefined' ? null : window.localStorage,
);

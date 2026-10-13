import { lessonEnglish } from './lessonEnglish';
import { moleEnglish } from './moleEnglish';
import { chanceEnglish } from './chanceEnglish';
import { domainEnglish } from './domainEnglish';
import { homeEnglish } from './homeEnglish';
import type { Locale } from './localeStore';

export const englishMessages = {
  '正在載入頁面…': 'Loading the page…',
  '這個頁面未能載入，請重新載入後再試。':
    'This page could not load. Reload and try again.',
  重新載入頁面: 'Reload page',
  ...lessonEnglish,
  ...moleEnglish,
  ...chanceEnglish,
  ...domainEnglish,
  ...homeEnglish,
  '要重置這個課程嗎？已保存的教學進度將被清除。':
    'Reset this lesson? Its saved teaching progress will be cleared.',
  '每次回答都來自可解釋的規則。課程進度保存在這台裝置。':
    'Every answer comes from an explainable rule. Lesson progress is saved on this device.',
  '、': ', ',
  取消: 'Cancel',
  重設課程: 'Reset lesson',
  確認重設: 'Confirm reset',
} as const;

export type MessageKey = keyof typeof englishMessages;
export type MessageValues = Readonly<
  Record<string, string | number | bigint | undefined>
>;
export type Translator = (key: MessageKey, values?: MessageValues) => string;

export function interpolate(message: string, values: MessageValues = {}): string {
  return message.replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
    values[name] === undefined ? placeholder : String(values[name]),
  );
}

/** Unknown source messages fall back unchanged, including unresolved placeholders. */
export function translate(locale: Locale, key: string, values?: MessageValues): string {
  return interpolate(
    locale === 'en' && isMessageKey(key) ? englishMessages[key] : key,
    values,
  );
}

export function isMessageKey(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(englishMessages, key);
}

export function translateKnownText(locale: Locale, source: string): string {
  return translate(locale, source);
}

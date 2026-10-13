import { resolveLessonRoute } from '../app/routes';
import type { AppRoute } from '../app/routes';
import type { Locale } from './localeStore';

const pageNames: Record<Locale, Record<AppRoute, string>> = {
  'zh-TW': {
    home: '教會推理出錯的機器人',
    fractionfox: 'FractionFox 分數狐狸',
    discountpanda: 'DiscountPanda 折扣熊貓',
    minusmole: 'MinusMole 負數鼴鼠',
    chancecrow: 'ChanceCrow 機率烏鴉',
    progress: '學習進度',
    passport: '學習護照',
  },
  en: {
    home: 'Teach the Wrong Robots',
    fractionfox: 'FractionFox — Fraction Addition',
    discountpanda: 'DiscountPanda — Successive Discounts',
    minusmole: 'MinusMole — Integer Subtraction',
    chancecrow: 'ChanceCrow — Probability Without Replacement',
    progress: 'Learning Progress',
    passport: 'Learning Passport',
  },
};

export function pageMetadata(locale: Locale, hash: string) {
  const route = resolveLessonRoute(hash);
  return {
    title:
      route === 'home'
        ? `BugZoo — ${pageNames[locale].home}`
        : `${pageNames[locale][route]} | BugZoo`,
    description:
      locale === 'en'
        ? 'Teach robots to correct mathematical misconceptions through experiments, counterexamples, and correct examples. Four explainable learning games, with progress saved only in your browser.'
        : '觀察錯誤、設計反例，用正確示例教會推理出錯的機器人。四個可解釋的數學教學遊戲，學習進度只保存在你的瀏覽器。',
    ogLocale: locale === 'en' ? 'en_US' : 'zh_TW',
    alternateLocale: locale === 'en' ? 'zh_TW' : 'en_US',
  };
}

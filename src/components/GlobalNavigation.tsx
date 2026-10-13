import { useI18n } from '../i18n';
import type { Locale } from '../i18n';
import { useProgressStore } from '../progress';
import { lessonLinks } from '../app/routes';
import type { AppRoute } from '../app/routes';
import './global-navigation.css';

const navigationCopy = {
  'zh-TW': {
    navigation: '全站導覽',
    skip: '略過導覽，前往目前頁面內容',
    home: '首頁',
    progress: '我的學習進度',
    passport: '學習護照',
    lesson: '選擇課程',
    language: '介面語言',
    saved: '進度已保存在這個瀏覽器',
    memory:
      '最新進度目前只保留在本次頁面中，無法確認已永久保存或清除。重新開啟可能回到先前已保存的進度。',
    invalid:
      '有課程資料損壞或版本不相容，無法安全恢復。請到學習進度頁查看並重置受影響的課程。',
  },
  en: {
    navigation: 'Site navigation',
    skip: 'Skip navigation to the current page content',
    home: 'Home',
    progress: 'My progress',
    passport: 'Learning Passport',
    lesson: 'Choose a lesson',
    language: 'Interface language',
    saved: 'Progress saved in this browser',
    memory:
      'The latest progress is available in this page only; permanent saving or removal could not be confirmed. Reopening may restore an older saved record.',
    invalid:
      'Some lesson data is damaged or uses an incompatible version. Open My progress to review and reset the affected lesson.',
  },
} satisfies Record<Locale, Record<string, string>>;

export function GlobalNavigation({ route }: { route: AppRoute }) {
  const { locale, setLocale } = useI18n();
  const text = navigationCopy[locale];
  const summaries = useProgressStore();
  const memoryOnly = summaries.some((summary) => summary.saveStatus === 'memory-only');
  const invalid = summaries.some(
    (summary) =>
      summary.saveStatus === 'corrupt' || summary.saveStatus === 'unsupported-version',
  );
  const activeLesson = Object.hasOwn(lessonLinks, route) ? route : '';
  const activeSummary = summaries.find((summary) => summary.lessonId === route);

  return (
    <div className="bz-navigation-wrap">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>('main')?.focus();
        }}
      >
        {text.skip}
      </a>
      <nav className="bz-navigation page-width" aria-label={text.navigation}>
        <div className="bz-navigation-links">
          <a href="#" aria-current={route === 'home' ? 'page' : undefined}>
            {text.home}
          </a>
          <a href="#progress" aria-current={route === 'progress' ? 'page' : undefined}>
            {text.progress}
          </a>
          <a href="#passport" aria-current={route === 'passport' ? 'page' : undefined}>
            {text.passport}
          </a>
        </div>
        <div className="bz-navigation-controls">
          <label>
            <span className="sr-only">{text.lesson}</span>
            <select
              aria-label={text.lesson}
              value={activeLesson}
              onChange={(event) => {
                const next = event.currentTarget.value;
                const link = Object.entries(lessonLinks).find(([id]) => id === next)?.[1];
                if (link) window.location.hash = link;
              }}
            >
              <option value="" disabled>
                {text.lesson}
              </option>
              <option value="fractionfox">FractionFox</option>
              <option value="discountpanda">DiscountPanda</option>
              <option value="minusmole">MinusMole</option>
              <option value="chancecrow">ChanceCrow</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{text.language}</span>
            <select
              aria-label={text.language}
              value={locale}
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (next === 'en' || next === 'zh-TW') setLocale(next);
              }}
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </nav>
      {(memoryOnly || invalid || activeSummary?.saveStatus === 'saved') && (
        <p
          className="bz-save-status page-width"
          role="status"
          data-warning={memoryOnly || invalid}
        >
          {memoryOnly ? text.memory : invalid ? text.invalid : text.saved}
        </p>
      )}
    </div>
  );
}

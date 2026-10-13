import { useI18n, translateKnownText } from '../i18n';
import type { Stage } from '../domain/teaching/engine';
import './lesson.css';

const steps = [
  { id: 'observe', name: '觀察', english: 'Observe' },
  { id: 'hypothesize', name: '猜想', english: 'Hypothesize' },
  { id: 'experiment', name: '實驗', english: 'Experiment' },
  { id: 'teach', name: '教學', english: 'Teach' },
  { id: 'verify', name: '驗證', english: 'Verify' },
] as const;

export function LessonProgress({ stage }: { readonly stage: Stage }) {
  const { t, locale } = useI18n();

  const activeIndex =
    stage === 'complete' ? steps.length : steps.findIndex((step) => step.id === stage);
  return (
    <ol className="ff-progress" aria-label={t('五步驟關卡進度')}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          data-active={index === activeIndex}
          data-done={index < activeIndex}
          aria-current={index === activeIndex ? 'step' : undefined}
        >
          <span className="ff-progress-number" aria-hidden="true">
            {index < activeIndex ? '✓' : index + 1}
          </span>
          <div>
            <strong>{translateKnownText(locale, step.name)}</strong>
            {locale === 'zh-TW' && <small lang="en">{step.english}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

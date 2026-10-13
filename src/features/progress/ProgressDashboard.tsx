import { RobotPortrait } from '../../components/RobotPortrait';
import { useI18n } from '../../i18n';
import { useProgressStore } from '../../progress';
import { DataManagement } from './DataManagement';
import { progressCopy, stageLabel } from './progressCopy';
import {
  lessonStatusLabel,
  lessonText,
  progressLessonDetails,
  summarizeProgress,
} from './progressModel';
import './progress.css';

export function ProgressDashboard() {
  const { locale } = useI18n();
  const summaries = useProgressStore();
  const copy = progressCopy(locale);
  const totals = summarizeProgress(summaries);
  const stats = [
    { label: copy.completed, value: `${totals.completed} / 4` },
    { label: copy.inProgress, value: totals.inProgress },
    { label: copy.effective, value: totals.effectiveExamples },
    { label: copy.verified, value: `${totals.verified} / 4` },
  ];

  return (
    <main id="main-content" className="page-width progress-page" tabIndex={-1}>
      <div className="progress-hero">
        <p className="eyebrow">BUGZOO · TEACH THE WRONG ROBOTS</p>
        <h1>{copy.dashboard}</h1>
        <p className="progress-description">{copy.dashboardIntro}</p>
        <div className="progress-actions">
          <a className="progress-button" href="#passport">
            {copy.viewPassport}
          </a>
          <a className="progress-button progress-button-secondary" href="#">
            {copy.home}
          </a>
        </div>
      </div>
      <dl className="progress-stats">
        {stats.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="progress-count-note">{copy.effectiveNote}</p>
      <section aria-labelledby="progress-lessons-heading">
        <div className="progress-section-heading">
          <div>
            <p className="eyebrow">YOUR CLASSROOM</p>
            <h2 id="progress-lessons-heading">{copy.courseList}</h2>
          </div>
        </div>
        <div className="progress-lesson-grid">
          {summaries.map((lesson) => {
            const details = progressLessonDetails[lesson.lessonId];
            return (
              <article
                key={lesson.lessonId}
                className="progress-lesson-card"
                data-kind={details.kind}
              >
                <div className="progress-lesson-art">
                  <RobotPortrait kind={details.kind} className="progress-robot" />
                  <span className="progress-status" data-status={lesson.status}>
                    {lessonStatusLabel(lesson.status, locale)}
                  </span>
                </div>
                <div className="progress-lesson-copy">
                  <p className="progress-topic">{lessonText(details.topic, locale)}</p>
                  <h3 lang="en">{details.name}</h3>
                  <p className="progress-current">
                    {copy.currentStep}:{' '}
                    <strong>{stageLabel(lesson.stage, locale)}</strong>
                  </p>
                  <dl className="progress-mini-stats">
                    <div>
                      <dt>{copy.effective}</dt>
                      <dd>{lesson.effectiveExamples}</dd>
                    </div>
                    <div>
                      <dt>{copy.verification}</dt>
                      <dd>
                        {lesson.verificationPassed} / {lesson.verificationTotal}
                      </dd>
                    </div>
                  </dl>
                  <a className="progress-button" href={`#${lesson.lessonId}`}>
                    {lesson.status === 'complete'
                      ? copy.viewResult
                      : lesson.status === 'in-progress'
                        ? copy.continue
                        : copy.start}
                    <span className="sr-only"> — {details.name}</span>
                    <span aria-hidden="true"> →</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <DataManagement />
    </main>
  );
}

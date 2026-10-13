import { useState } from 'react';
import { RobotPortrait } from '../../components/RobotPortrait';
import { useI18n } from '../../i18n';
import { useProgressStore } from '../../progress';
import { AchievementBadge } from './AchievementBadge';
import { DataManagement } from './DataManagement';
import { createLearningMarkdown, downloadLearningMarkdown } from './markdownExport';
import { progressCopy, stageLabel } from './progressCopy';
import {
  earnedAchievements,
  eliminatedMisconceptions,
  lessonStatusLabel,
  lessonText,
  progressLessonDetails,
  verificationLabel,
} from './progressModel';
import './progress.css';

export function LearningPassport() {
  const { locale } = useI18n();
  const summaries = useProgressStore();
  const copy = progressCopy(locale);
  const achievements = earnedAchievements(summaries);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  function exportSummary() {
    try {
      const now = new Date();
      downloadLearningMarkdown(createLearningMarkdown(summaries, locale, now), now);
      setExportStatus('success');
    } catch {
      setExportStatus('error');
    }
  }

  return (
    <main id="main-content" className="page-width progress-page" tabIndex={-1}>
      <div className="progress-hero">
        <p className="eyebrow">BUGZOO · EVIDENCE OF LEARNING</p>
        <h1>{copy.passport}</h1>
        <p className="progress-description">{copy.passportIntro}</p>
        <div className="progress-actions">
          <button className="progress-button" type="button" onClick={exportSummary}>
            {copy.export}
          </button>
          <a className="progress-button progress-button-secondary" href="#progress">
            {copy.viewDashboard}
          </a>
        </div>
        <p className="progress-count-note">{copy.exportNote}</p>
        <p role="status" aria-live="polite" className="progress-export-notice">
          {exportStatus === 'success'
            ? copy.exported
            : exportStatus === 'error'
              ? copy.exportFailed
              : ''}
        </p>
      </div>
      <section
        className="progress-achievements"
        aria-labelledby="progress-achievements-heading"
      >
        <div className="progress-section-heading">
          <div>
            <p className="eyebrow">EARNED THROUGH EVIDENCE</p>
            <h2 id="progress-achievements-heading">{copy.achievements}</h2>
          </div>
        </div>
        {achievements.length === 0 ? (
          <p className="progress-empty-achievements">{copy.noAchievements}</p>
        ) : (
          <ul className="progress-achievement-grid">
            {achievements.map((id) => {
              const details = progressLessonDetails[id];
              return (
                <li key={id}>
                  <AchievementBadge kind={details.kind} />
                  <div>
                    <strong>{lessonText(details.achievement, locale)}</strong>
                    <p lang="en">{details.name}</p>
                    <span>{copy.achievementEarned}</span>
                    <p className="progress-achievement-description">
                      {lessonText(details.achievementDescription, locale)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="progress-count-note">{copy.achievementScope}</p>
      </section>
      <section aria-labelledby="progress-passport-records-heading">
        <div className="progress-section-heading">
          <div>
            <p className="eyebrow">LEARNING RECORDS</p>
            <h2 id="progress-passport-records-heading">{copy.actualProgress}</h2>
          </div>
        </div>
        <p className="progress-count-note">
          {copy.verificationRequired} {copy.effectiveNote}
        </p>
        <div className="progress-passport-records">
          {summaries.map((lesson) => {
            const details = progressLessonDetails[lesson.lessonId];
            const eliminated = eliminatedMisconceptions(lesson, locale);
            return (
              <article
                key={lesson.lessonId}
                className="progress-passport-card"
                data-kind={details.kind}
              >
                <header className="progress-record-header">
                  <RobotPortrait
                    kind={details.kind}
                    className="progress-record-portrait"
                  />
                  <div>
                    <p className="progress-topic">{lessonText(details.topic, locale)}</p>
                    <h3 lang="en">{details.name}</h3>
                    <p className="progress-current">
                      {copy.currentStep}: {stageLabel(lesson.stage, locale)}
                    </p>
                  </div>
                  <span className="progress-status" data-status={lesson.status}>
                    {lessonStatusLabel(lesson.status, locale)}
                  </span>
                </header>
                <div className="progress-record-body">
                  <div>
                    <h4>{copy.eliminated}</h4>
                    {eliminated.length ? (
                      <ul className="progress-eliminated-list">
                        {eliminated.map((item) => (
                          <li key={item}>
                            <span aria-hidden="true">✓ </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="progress-description">{copy.noneEliminated}</p>
                    )}
                    <p className="progress-evidence-count">
                      {copy.effective}: <strong>{lesson.effectiveExamples}</strong>
                    </p>
                    <h4>{copy.verification}</h4>
                    <p>
                      {verificationLabel(lesson, locale)}{' '}
                      <strong>
                        ({lesson.verificationPassed} / {lesson.verificationTotal})
                      </strong>
                    </p>
                  </div>
                  <div className="progress-concept">
                    <h4>{copy.concept}</h4>
                    <p>{lessonText(details.concept, locale)}</p>
                  </div>
                </div>
                <a className="progress-text-button" href={`#${lesson.lessonId}`}>
                  {lesson.status === 'complete'
                    ? copy.viewResult
                    : lesson.status === 'in-progress'
                      ? copy.continue
                      : copy.start}
                  <span className="sr-only"> — {details.name}</span>
                  <span aria-hidden="true"> →</span>
                </a>
              </article>
            );
          })}
        </div>
      </section>
      <DataManagement />
    </main>
  );
}

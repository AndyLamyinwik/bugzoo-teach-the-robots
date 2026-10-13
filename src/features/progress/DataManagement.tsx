import { useState } from 'react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { interpolate, useI18n } from '../../i18n';
import { progressStore, useProgressStore } from '../../progress';
import type { LessonId } from '../../progress';
import { progressCopy, saveStatusLabel } from './progressCopy';
import { progressLessonDetails, progressLessonIds } from './progressModel';

interface ClearNotice {
  readonly lessonId: LessonId | 'all';
  readonly removalFailed: boolean;
}

export function DataManagement() {
  const { locale } = useI18n();
  const summaries = useProgressStore();
  const copy = progressCopy(locale);
  const [notice, setNotice] = useState<ClearNotice | null>(null);
  const [pendingReset, setPendingReset] = useState<LessonId | 'all' | null>(null);

  function clearLesson(id: LessonId) {
    setPendingReset(id);
  }

  function clearAll() {
    setPendingReset('all');
  }

  function confirmReset() {
    if (pendingReset === null) return;
    if (pendingReset === 'all') {
      progressStore.resetAll();
      setNotice({
        lessonId: 'all',
        removalFailed: progressLessonIds.some(
          (id) => progressStore.getSnapshot(id).saveStatus === 'memory-only',
        ),
      });
    } else {
      progressStore.resetLesson(pendingReset);
      setNotice({
        lessonId: pendingReset,
        removalFailed:
          progressStore.getSnapshot(pendingReset).saveStatus === 'memory-only',
      });
    }
    setPendingReset(null);
  }

  const noticeText =
    notice === null
      ? ''
      : notice.removalFailed
        ? copy.removalFailed
        : notice.lessonId === 'all'
          ? copy.clearDone
          : interpolate(copy.resetDone, {
              name: progressLessonDetails[notice.lessonId].name,
            });

  return (
    <section className="progress-data" aria-labelledby="progress-data-heading">
      <div className="progress-section-heading">
        <div>
          <p className="eyebrow">LOCAL ONLY</p>
          <h2 id="progress-data-heading">{copy.data}</h2>
        </div>
      </div>
      <p className="progress-description">{copy.privacy}</p>
      {summaries.some((lesson) => lesson.saveStatus === 'memory-only') && (
        <p className="progress-storage-warning" role="status">
          {copy.fallbackWarning}
        </p>
      )}
      {summaries.some((lesson) => lesson.saveStatus === 'corrupt') && (
        <p className="progress-storage-warning" role="status">
          {copy.corruptedWarning}
        </p>
      )}
      {summaries.some((lesson) => lesson.saveStatus === 'unsupported-version') && (
        <p className="progress-storage-warning" role="status">
          {copy.versionWarning}
        </p>
      )}
      <ul className="progress-storage-list">
        {summaries.map((lesson) => (
          <li key={lesson.lessonId}>
            <div>
              <strong lang="en">{progressLessonDetails[lesson.lessonId].name}</strong>
              <span>
                {copy.saveState}: {saveStatusLabel(lesson.saveStatus, locale)}
              </span>
            </div>
            <button
              type="button"
              className="progress-text-button"
              onClick={() => clearLesson(lesson.lessonId)}
              aria-label={`${copy.resetLesson} — ${progressLessonDetails[lesson.lessonId].name}`}
            >
              {copy.resetLesson}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="progress-button progress-button-danger"
        onClick={clearAll}
      >
        {copy.clearAll}
      </button>
      <p className="progress-action-notice" role="status" aria-live="polite">
        {noticeText}
      </p>
      <ConfirmationDialog
        open={pendingReset !== null}
        title={pendingReset === 'all' ? copy.clearAll : copy.resetLesson}
        description={
          pendingReset === 'all'
            ? copy.confirmAll
            : pendingReset === null
              ? ''
              : interpolate(copy.confirmLesson, {
                  name: progressLessonDetails[pendingReset].name,
                })
        }
        confirmLabel={pendingReset === 'all' ? copy.clearAll : copy.resetLesson}
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(null)}
      />
    </section>
  );
}

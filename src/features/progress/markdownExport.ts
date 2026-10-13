import type { Locale } from '../../i18n';
import type { LessonSummary } from '../../progress';
import { progressCopy, stageLabel } from './progressCopy';
import {
  earnedAchievements,
  eliminatedMisconceptions,
  lessonStatusLabel,
  lessonText,
  progressLessonDetails,
  summarizeProgress,
  verificationLabel,
} from './progressModel';

/** A pure summary of validated progress, never a claim inferred from experiments. */
export function createLearningMarkdown(
  summaries: readonly LessonSummary[],
  locale: Locale,
  exportedAt: Date,
): string {
  const copy = progressCopy(locale);
  const totals = summarizeProgress(summaries);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(exportedAt);
  const lines = [
    `# ${copy.reportTitle}`,
    '',
    `${copy.exportDate}: ${date}`,
    '',
    `- ${copy.completed}: ${totals.completed} / 4`,
    `- ${copy.inProgress}: ${totals.inProgress}`,
    `- ${copy.effective}: ${totals.effectiveExamples}`,
    `- ${copy.verified}: ${totals.verified} / 4`,
    '',
    copy.effectiveNote,
    '',
    `## ${copy.actualProgress}`,
    '',
  ];
  for (const lesson of summaries) {
    const details = progressLessonDetails[lesson.lessonId];
    const eliminated = eliminatedMisconceptions(lesson, locale);
    lines.push(
      `### ${details.name} — ${lessonText(details.topic, locale)}`,
      '',
      `- ${copy.status}: ${lessonStatusLabel(lesson.status, locale)}`,
      `- ${copy.currentStep}: ${stageLabel(lesson.stage, locale)}`,
      `- ${copy.effective}: ${lesson.effectiveExamples}`,
      `- ${copy.verification}: ${verificationLabel(lesson, locale)} (${lesson.verificationPassed} / ${lesson.verificationTotal})`,
      '',
      `**${copy.eliminated}**`,
      '',
      ...(eliminated.length
        ? eliminated.map((item) => `- ${item}`)
        : [copy.noneEliminated]),
      '',
      `**${copy.concept}**`,
      '',
      lessonText(details.concept, locale),
      '',
    );
  }
  const achievements = earnedAchievements(summaries);
  lines.push(
    `## ${copy.achievements}`,
    '',
    ...(achievements.length
      ? achievements.map(
          (id) =>
            `- ${progressLessonDetails[id].name}: ${lessonText(progressLessonDetails[id].achievement, locale)} — ${lessonText(progressLessonDetails[id].achievementDescription, locale)}`,
        )
      : [copy.noAchievements]),
    '',
    copy.achievementScope,
    '',
    copy.verificationRequired,
    '',
  );
  return lines.join('\n');
}

/** Browser-only download boundary; no network or document service is involved. */
export function downloadLearningMarkdown(markdown: string, exportedAt: Date): void {
  const url = URL.createObjectURL(
    new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
  );
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = `BugZoo-learning-passport-${exportedAt.toISOString().slice(0, 10)}.md`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

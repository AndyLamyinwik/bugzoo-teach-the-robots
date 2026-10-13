import type { Feedback } from '../domain/teaching/engine';

/** Link field errors to the existing localized feedback; the domain owns validation. */
export function fieldErrorId(
  feedback: Feedback | null,
  path: readonly string[],
  feedbackId: string,
): string | undefined {
  if (feedback?.kind !== 'error') return undefined;
  if (
    path[0] === 'proposedAnswer' &&
    (feedback.code === 'incorrect-example' || feedback.code === 'incorrect-verification')
  )
    return feedbackId;
  return feedback.issues?.some((issue) =>
    issue.path.every((part, index) => part === path[index]),
  )
    ? feedbackId
    : undefined;
}

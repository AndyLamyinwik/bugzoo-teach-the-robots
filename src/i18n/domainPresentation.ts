import type { RuleEvaluation } from '../domain/contracts';
import type { Feedback } from '../domain/teaching/engine';
import type { NumberLineSegment } from '../domain/minusMole/numberLine';
import type { Locale } from './localeStore';
import { translate, translateKnownText, isMessageKey } from './messages';
import { reasoningTemplates, validationSources } from './domainTemplates';

/** Present trace parameters only; never recompute or normalize a rule's answer. */
export function explainLocalizedEvaluation(
  evaluation: RuleEvaluation<unknown>,
  locale: Locale,
): readonly string[] {
  return evaluation.steps.map(({ explanationKey, parameters = {} }) => {
    if (explanationKey === 'minus.result')
      return translate(locale, '這條規則給出的答案是 {v0}。', { v0: parameters.answer });
    if (explanationKey.startsWith('minus.')) {
      if (locale === 'zh-TW') return parameters.label ?? explanationKey;
      const direction =
        parameters.direction === 'left'
          ? 'left'
          : parameters.direction === 'right'
            ? 'right'
            : 'nowhere';
      if (explanationKey === 'minus.reflect-result')
        return translate(
          locale,
          '錯誤規則把負數結果 {v0} 取絕對值，跨過零鏡射到 {v1}；這個鏡射不是減法步驟。',
          { v0: parameters.from, v1: parameters.to },
        );
      return explanationKey === 'minus.subtract-absolute'
        ? `The misconception ignores the subtrahend’s minus sign. Start at ${parameters.from} and move ${direction} ${parameters.distance} units to ${parameters.to}.`
        : `Start at ${parameters.from} and move ${direction} ${parameters.distance} units to ${parameters.to}. Subtracting a negative moves right; subtracting a positive moves left.`;
    }
    if (!Object.prototype.hasOwnProperty.call(reasoningTemplates, explanationKey))
      return explanationKey;
    const template =
      reasoningTemplates[explanationKey as keyof typeof reasoningTemplates];
    return translate(
      locale,
      template[0],
      Object.fromEntries(
        template[1].map((name, index) => [
          `v${index}`,
          parameters[name] === undefined
            ? 'undefined'
            : translateKnownText(locale, parameters[name]),
        ]),
      ),
    );
  });
}

export function localizeNumberLineLabel(
  segment: NumberLineSegment,
  locale: Locale,
): string {
  if (locale === 'zh-TW') return segment.label;
  if (segment.kind === 'reflect')
    return translate(
      locale,
      '錯誤規則把負數結果 {v0} 取絕對值，跨過零鏡射到 {v1}；這個鏡射不是減法步驟。',
      { v0: segment.from, v1: segment.to },
    );
  const direction =
    segment.direction === 'left'
      ? 'left'
      : segment.direction === 'right'
        ? 'right'
        : 'nowhere';
  const movement = `From ${segment.from}, move ${direction} ${segment.distance} units to ${segment.to}.`;
  return (
    movement +
    (segment.isMisconception
      ? ' This misconception takes the subtrahend’s absolute value and loses its sign.'
      : ' Subtracting a negative moves right; subtracting a positive moves left.')
  );
}

export interface FeedbackParameters {
  readonly prediction?: string;
  readonly observed?: string;
  readonly eliminated?: number;
}
export function localizeFeedback(
  feedback: Feedback,
  locale: Locale,
  robotName: string,
  parameters: FeedbackParameters = {},
): string {
  if (locale === 'zh-TW') return feedback.message;
  if (feedback.code === 'invalid-input' && feedback.issues)
    return [
      ...new Set(
        feedback.issues.map((issue) =>
          translate(locale, validationSources[issue.messageKey] ?? issue.messageKey),
        ),
      ),
    ].join(' ');
  if (isMessageKey(feedback.message)) return translate(locale, feedback.message);
  switch (feedback.code) {
    case 'ready-hypothesis':
      return translate(locale, '先猜猜 {v0} 使用了哪條推理規則，再用實驗檢查。', {
        v0: robotName,
      });
    case 'hypothesis-matches':
    case 'hypothesis-differs':
      return translate(
        locale,
        '你的假設預測 {v0}，{v1}剛才觀察到的 {v2}。猜測不會淘汰規則，接著設計實驗。',
        {
          v0: parameters.prediction ?? '?',
          v1: feedback.code === 'hypothesis-matches' ? 'matches' : 'differs from',
          v2: parameters.observed ?? '?',
        },
      );
    case 'rules-eliminated':
      return translate(
        locale,
        '已根據這個正確示例排除 {v0} 條錯誤規則。還有候選規則，需要更多證據。',
        { v0: parameters.eliminated ?? 0 },
      );
    case 'lesson-complete':
      return translate(
        locale,
        '你和 {v0} 都通過了三道未見題！在這組已知規則中，錯誤假設已被證據排除。',
        { v0: robotName },
      );
    default:
      return translateKnownText(locale, feedback.message);
  }
}

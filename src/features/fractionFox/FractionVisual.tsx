import type { Translator } from '../../i18n';
import { useI18n, translateKnownText } from '../../i18n';
import type { Rational } from '../../domain/math/rational';
import './fraction-components.css';

export type FractionTerms = Rational;

interface FractionValueProps {
  value: FractionTerms;
  label?: string;
}

interface AdditionEquationProps {
  input: { readonly left: FractionTerms; readonly right: FractionTerms };
  answer: FractionTerms;
  label?: string;
}

function spokenFraction(value: FractionTerms, t: Translator): string {
  return t('{v0} 分之 {v1}', {
    v0: value.denominator.toString(),
    v1: value.numerator.toString(),
  });
}

/** Display the supplied terms without normalizing or judging the answer. */
export function FractionValue({ value, label }: FractionValueProps) {
  const { locale, t } = useI18n();

  const accessibleLabel = label
    ? `${translateKnownText(locale, label)}：${spokenFraction(value, t)}`
    : spokenFraction(value, t);

  return (
    <span aria-label={accessibleLabel} className="ff-fraction-value" role="img">
      <span aria-hidden="true" className="ff-fraction-numerator">
        {value.numerator.toString()}
      </span>
      <span aria-hidden="true" className="ff-fraction-denominator">
        {value.denominator.toString()}
      </span>
    </span>
  );
}

export function AdditionEquation({ input, answer, label }: AdditionEquationProps) {
  const { t, locale } = useI18n();

  const equationLabel = t('{v0} 加 {v1} 等於 {v2}', {
    v0: spokenFraction(input.left, t),
    v1: spokenFraction(input.right, t),
    v2: spokenFraction(answer, t),
  });

  return (
    <div
      aria-label={
        label ? `${translateKnownText(locale, label)}：${equationLabel}` : equationLabel
      }
      className="ff-equation"
      role="img"
    >
      <div aria-hidden="true" className="ff-equation-terms">
        <FractionValue value={input.left} />
        <span className="ff-equation-operator">+</span>
        <FractionValue value={input.right} />
        <span className="ff-equation-operator">=</span>
        <span className="ff-equation-answer">
          <FractionValue value={answer} />
        </span>
      </div>
    </div>
  );
}

/** A bounded presentation aid; all eligibility checks still use exact bigint terms. */
export function FractionArea({ value, label }: FractionValueProps) {
  const { t, locale } = useI18n();

  const canShowArea =
    value.denominator > 0n &&
    value.denominator <= 24n &&
    value.numerator >= 0n &&
    value.numerator < value.denominator;

  if (!canShowArea) {
    return (
      <div className="ff-area ff-area--text">
        <FractionValue label={label ?? t('分數')} value={value} />
      </div>
    );
  }

  // Conversions are safe after the bounds above, and only control drawing counts.
  const portionCount = Number(value.denominator);
  const filledCount = Number(value.numerator);
  const description = t('{v0}：將一個整體平分為 {v1} 份，其中 {v2} 份著色', {
    v0: spokenFraction(value, t),
    v1: portionCount,
    v2: filledCount,
  });

  return (
    <figure
      aria-label={
        label ? `${translateKnownText(locale, label)}：${description}` : description
      }
      className="ff-area"
      role="img"
    >
      <div
        aria-hidden="true"
        className="ff-area-grid"
        style={{ gridTemplateColumns: `repeat(${portionCount}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: portionCount }, (_, index) => (
          <span
            className={
              index < filledCount
                ? 'ff-area-portion ff-area-portion--filled'
                : 'ff-area-portion'
            }
            key={index}
          />
        ))}
      </div>
      <figcaption aria-hidden="true" className="ff-area-caption">
        {filledCount} / {portionCount}
        {t(' 份')}
      </figcaption>
    </figure>
  );
}

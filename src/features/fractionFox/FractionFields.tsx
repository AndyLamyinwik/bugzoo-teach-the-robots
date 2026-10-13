import { useI18n, translateKnownText } from '../../i18n';
import { useId } from 'react';
import './fraction-components.css';

export interface FractionDraft {
  readonly numerator: string;
  readonly denominator: string;
}

interface FractionFieldsProps {
  label: string;
  value: FractionDraft;
  onChange: (value: FractionDraft) => void;
  disabled?: boolean;
  errorId?: (field: keyof FractionDraft) => string | undefined;
}

/** Keep editing values as strings; validation belongs to the experiment boundary. */
export function FractionFields({
  label,
  value,
  onChange,
  disabled = false,
  errorId,
}: FractionFieldsProps) {
  const { locale, t } = useI18n();

  const inputId = useId();
  const numeratorId = `${inputId}-numerator`;
  const denominatorId = `${inputId}-denominator`;

  return (
    <fieldset className="ff-fields" disabled={disabled}>
      <legend className="ff-fields-legend">{translateKnownText(locale, label)}</legend>
      <div className="ff-input-pair">
        <div className="ff-field">
          <label htmlFor={numeratorId}>
            {translateKnownText(locale, label)}
            {t('分子')}
          </label>
          <input
            aria-invalid={errorId?.('numerator') ? true : undefined}
            aria-describedby={errorId?.('numerator')}
            autoComplete="off"
            id={numeratorId}
            inputMode="text"
            maxLength={14}
            onChange={(event) =>
              onChange({ ...value, numerator: event.currentTarget.value })
            }
            spellCheck={false}
            type="text"
            value={value.numerator}
          />
        </div>
        <div className="ff-field">
          <label htmlFor={denominatorId}>
            {translateKnownText(locale, label)}
            {t('分母')}
          </label>
          <input
            aria-invalid={errorId?.('denominator') ? true : undefined}
            aria-describedby={errorId?.('denominator')}
            autoComplete="off"
            id={denominatorId}
            inputMode="numeric"
            maxLength={14}
            onChange={(event) =>
              onChange({ ...value, denominator: event.currentTarget.value })
            }
            spellCheck={false}
            type="text"
            value={value.denominator}
          />
        </div>
      </div>
    </fieldset>
  );
}

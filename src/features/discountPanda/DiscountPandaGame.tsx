import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { fieldErrorId } from '../../components/fieldFeedback';
import { useLessonProgress, progressStore } from '../../progress';
import {
  explainLocalizedEvaluation,
  localizeFeedback,
} from '../../i18n/domainPresentation';
import { useI18n, translateKnownText } from '../../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { LessonProgress } from '../../components/LessonProgress';
import { RobotPortrait } from '../../components/RobotPortrait';
import type { RuleEvaluation } from '../../domain/contracts';
import {
  answerVerification,
  beginHypothesis,
  beginTeaching,
  beginVerification,
  chooseHypothesis,
  createSession,
  evaluateRule,
  formatMoney,
  formatPercent,
  isReadyForVerification,
  observationInput,
  runExperiment,
  teachExample,
} from '../../domain/discountPanda/engine';
import type {
  DiscountInput,
  RawDiscountInput,
  RuleId,
  SessionState,
} from '../../domain/discountPanda/engine';
import '../../components/lesson.css';
import './discount-panda.css';

function useRuleCopy(): Record<RuleId, { title: string; description: string }> {
  const { t } = useI18n();
  return {
    correct: {
      title: t('正確：依序折扣'),
      description: t('第二次折扣以第一次折扣後的價格為基準。'),
    },
    'add-discounts': {
      title: t('迷思 A：直接相加'),
      description: t('將兩次減價百分比相加，再從原價扣除；合計超過 100% 時歸零。'),
    },
    'only-second': {
      title: t('迷思 B：只算第二次'),
      description: t('忽略第一次折扣，只將第二次折扣套用在原價。'),
    },
  };
}
const ruleIds: readonly RuleId[] = ['correct', 'add-discounts', 'only-second'];

function initialDraft(): RawDiscountInput {
  return { price: '100', firstDiscount: '20', secondDiscount: '10' };
}

function toDraft(input: DiscountInput): RawDiscountInput {
  return {
    price: formatMoney(input.priceCents),
    firstDiscount: formatPercent(input.firstDiscount),
    secondDiscount: formatPercent(input.secondDiscount),
  };
}

function InputSummary({ input }: { input: DiscountInput }) {
  const { t } = useI18n();

  return (
    <p className="dp-input-summary">
      {t('原價 ')}
      {formatMoney(input.priceCents)}
      {t(' 元')}
      <span>
        {t('第一次減價 ')}
        {formatPercent(input.firstDiscount)}%
      </span>
      <span>
        {t('第二次減價 ')}
        {formatPercent(input.secondDiscount)}%
      </span>
    </p>
  );
}

function PriceFields({
  value,
  onChange,
  errorId,
}: {
  value: RawDiscountInput;
  onChange: (value: RawDiscountInput) => void;
  errorId: (path: readonly string[]) => string | undefined;
}) {
  const { t, locale } = useI18n();

  const formId = useId();
  const fields = [
    { key: 'price', label: t('商品原價'), unit: t('元') },
    { key: 'firstDiscount', label: t('第一次折扣百分比'), unit: '%' },
    { key: 'secondDiscount', label: t('第二次折扣百分比'), unit: '%' },
  ] as const;

  return (
    <div className="dp-fields">
      {fields.map(({ key, label, unit }) => (
        <div className="dp-field" key={key}>
          <label htmlFor={`${formId}-${key}`}>{translateKnownText(locale, label)}</label>
          <div className="dp-input-wrap">
            <input
              aria-invalid={errorId(['input', key]) ? true : undefined}
              aria-describedby={errorId(['input', key])}
              autoComplete="off"
              id={`${formId}-${key}`}
              inputMode="decimal"
              maxLength={16}
              onChange={(event) =>
                onChange({ ...value, [key]: event.currentTarget.value })
              }
              spellCheck={false}
              type="text"
              value={value[key]}
            />
            <span aria-hidden="true">{unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnswerField({
  label,
  value,
  onChange,
  errorId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  errorId: string | undefined;
}) {
  const { locale, t } = useI18n();

  const answerId = useId();
  return (
    <div className="dp-field dp-answer-field">
      <label htmlFor={answerId}>{translateKnownText(locale, label)}</label>
      <div className="dp-input-wrap">
        <input
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
          autoComplete="off"
          id={answerId}
          inputMode="decimal"
          maxLength={16}
          onChange={(event) => onChange(event.currentTarget.value)}
          spellCheck={false}
          type="text"
          value={value}
        />
        <span aria-hidden="true">{t('元')}</span>
      </div>
    </div>
  );
}

function PriceQuote({ label, value }: { label: string; value: bigint }) {
  const { locale, t } = useI18n();

  return (
    <div className="dp-price-quote">
      <span>{translateKnownText(locale, label)}</span>
      <strong>
        {formatMoney(value)} <small>{t('元')}</small>
      </strong>
    </div>
  );
}

/** Exact prices come from the rule trace. Number is used only for bar drawing. */
function PriceStair({ input }: { input: DiscountInput }) {
  const { t } = useI18n();

  const evaluation = evaluateRule('correct', input);
  const firstPrice = evaluation.steps.find(
    (step) => step.explanationKey === 'discount.first-applied',
  )?.parameters?.exactPrice;
  const finalExactPrice = evaluation.steps.find(
    (step) => step.explanationKey === 'discount.round-final',
  )?.parameters?.exactPrice;
  if (firstPrice === undefined || finalExactPrice === undefined) return null;

  const originalPrice = formatMoney(input.priceCents);
  const stages = [
    { label: t('商品原價'), exactPrice: originalPrice, displayPrice: originalPrice },
    {
      label: t('第一次減價 {v0}% 後', { v0: formatPercent(input.firstDiscount) }),
      exactPrice: firstPrice,
      displayPrice: firstPrice,
    },
    {
      label: t('再減價 {v0}% 後', { v0: formatPercent(input.secondDiscount) }),
      exactPrice: finalExactPrice,
      displayPrice: formatMoney(evaluation.answer),
    },
  ];
  const originalForDrawing = Number(originalPrice);

  return (
    <figure className="dp-price-stair" aria-label={t('依序折扣的正確價格變化')}>
      <figcaption>{t('每次折扣，都從當下的價格出發')}</figcaption>
      <ol>
        {stages.map((stage, index) => {
          const width =
            originalForDrawing === 0
              ? 0
              : (Number(stage.exactPrice) / originalForDrawing) * 100;
          return (
            <li key={stage.label}>
              <div className="dp-stair-label">
                <span>
                  <b aria-hidden="true">{index + 1}</b>
                  {stage.label}
                </span>
                <strong>
                  {stage.displayPrice} <small>{t('元')}</small>
                </strong>
              </div>
              <div className="dp-bar-track" aria-hidden="true">
                <div className="dp-bar" style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      <p>{t('第一步保留精確值；最後一步才四捨五入到小數點後兩位。')}</p>
    </figure>
  );
}

function ReasoningDialogue({ evaluation }: { evaluation: RuleEvaluation<bigint> }) {
  const { t, locale } = useI18n();

  return (
    <div className="ff-dialogue">
      <RobotPortrait kind="panda" className="ff-dialogue-portrait" />
      <div>
        <p>{t('DiscountPanda 的推理')}</p>
        <ol className="ff-reasoning">
          {explainLocalizedEvaluation(evaluation, locale).map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function CandidatePanel({ session }: { session: SessionState }) {
  const { t } = useI18n();
  const ruleCopy = useRuleCopy();

  return (
    <aside className="ff-sidebar" aria-label={t('候選規則與折扣提示')}>
      <section className="ff-panel" aria-labelledby="dp-candidates-title">
        <h2 id="dp-candidates-title">{t('候選規則')}</h2>
        <p className="ff-candidate-count" aria-live="polite">
          <strong>{session.candidateRuleIds.length}</strong>
          <span>{t('/ 3 條仍符合證據')}</span>
        </p>
        <ul className="ff-candidate-list">
          {ruleIds.map((id) => {
            const eliminated = !session.candidateRuleIds.includes(id);
            return (
              <li key={id} data-eliminated={eliminated}>
                <div className="ff-candidate-row">
                  <strong>{ruleCopy[id].title}</strong>
                  <span className="ff-rule-status">
                    {eliminated ? t('已排除') : t('保留')}
                  </span>
                </div>
                <p>{ruleCopy[id].description}</p>
              </li>
            );
          })}
        </ul>
        <p className="ff-sidebar-note">
          {t('猜想與實驗只幫助觀察。只有經過核對的正確教學答案，才會改變候選規則。')}
        </p>
      </section>
      <section className="ff-panel" aria-labelledby="dp-tip-title">
        <h2 id="dp-tip-title">{t('老師的小提醒')}</h2>
        <p className="ff-sidebar-note">
          {t(
            '每次減價的基準相同嗎？試試改變兩次百分比，也觀察零折扣與完全減價時的結果。',
          )}
        </p>
        {session.hypothesis && (
          <p className="ff-sidebar-note">
            {t('你的初始猜想：')}
            {ruleCopy[session.hypothesis].title}
            {t('。')}
          </p>
        )}
      </section>
    </aside>
  );
}

export function DiscountPandaGame() {
  const { t, locale } = useI18n();
  const ruleCopy = useRuleCopy();

  const [session, setSession] = useLessonProgress('discountpanda', createSession);
  const robotName = 'DiscountPanda';
  const feedbackParameters = {
    prediction: session.hypothesis
      ? formatMoney(evaluateRule(session.hypothesis, observationInput).answer)
      : '?',
    observed: formatMoney(
      evaluateRule(createSession().currentRuleId, observationInput).answer,
    ),
    eliminated: session.evidence.at(-1)?.eliminatedRuleIds.length ?? 0,
  };
  const [feedback, setFeedback] = useState<
    ReturnType<typeof runExperiment>['feedback'] | null
  >(null);
  const feedbackId = useId();
  const errorId = (path: readonly string[]) => fieldErrorId(feedback, path, feedbackId);
  const [hypothesis, setHypothesis] = useState<RuleId | null>(null);
  const [experimentDraft, setExperimentDraft] = useState(initialDraft);
  const [teachingDraft, setTeachingDraft] = useState(initialDraft);
  const [teachingAnswer, setTeachingAnswer] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [restartOpen, setRestartOpen] = useState(false);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const latestExperiment = session.experiments.at(-1);
  const latestEvidence = session.evidence.at(-1);
  const question = session.verification[session.verificationAnswers.length];
  const readyToVerify = isReadyForVerification(session);

  useEffect(() => {
    stageHeading.current?.focus();
  }, [session.stage]);

  function apply(result: ReturnType<typeof runExperiment>) {
    setSession(result.state);
    setFeedback(result.feedback);
  }

  function restart() {
    setRestartOpen(true);
  }

  function performRestart() {
    setRestartOpen(false);
    progressStore.resetLesson('discountpanda');
    setFeedback(null);
    setHypothesis(null);
    setExperimentDraft(initialDraft());
    setTeachingDraft(initialDraft());
    setTeachingAnswer('');
    setVerificationAnswer('');
  }

  function startTeaching() {
    const result = beginTeaching(session);
    apply(result);
    if (result.state.stage === 'teach' && latestExperiment) {
      setTeachingDraft(toDraft(latestExperiment.input));
    }
  }

  function submitExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(runExperiment(session, experimentDraft));
  }

  function submitTeaching(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(
      teachExample(session, { input: teachingDraft, proposedAnswer: teachingAnswer }),
    );
  }

  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question) return;
    const result = answerVerification(session, question.id, verificationAnswer);
    apply(result);
    if (result.state.verificationAnswers.length > session.verificationAnswers.length) {
      setVerificationAnswer('');
    }
  }

  return (
    <div className="ff-game dp-game">
      <a className="skip-link" href="#discountpanda-content">
        {t('跳到遊戲內容')}
      </a>
      <header className="ff-header page-width">
        <a href="#" className="ff-header-brand" aria-label={t('BugZoo 首頁')}>
          BugZoo<span className="brand-dot">.</span>
        </a>
        <div className="ff-header-actions">
          <a className="ff-back" href="#">
            {t('返回首頁')}
          </a>
          <button
            className="ff-button ff-button-secondary"
            type="button"
            onClick={restart}
          >
            {t('重新開始')}
          </button>
        </div>
      </header>
      <main id="discountpanda-content" className="page-width" tabIndex={-1}>
        <div className="ff-lesson-intro">
          <RobotPortrait kind="panda" className="ff-intro-portrait" />
          <div>
            <p className="ff-kicker">{t('LESSON 02 / 連續百分比折扣')}</p>
            <h1>{t('DiscountPanda 的折扣商店')}</h1>
            <p>{t('兩次減價，兩個基準。用你的實驗，教會牠看懂價格的每一步。')}</p>
          </div>
        </div>
        <div className="dp-policy">
          <strong>{t('本課程的計算方式')}</strong>
          <p>
            {t(
              '折扣百分比表示減價比例：減價 20% 就是付原價的 80%。兩次依序計算，中途不捨入，最後才四捨五入至小數點後兩位；恰好半分時進位。',
            )}
          </p>
        </div>
        <LessonProgress stage={session.stage} />
        <div className="ff-workspace">
          <section className="ff-panel" aria-labelledby="dp-stage-title">
            <h2
              className="ff-stage-heading"
              id="dp-stage-title"
              ref={stageHeading}
              tabIndex={-1}
            >
              {session.stage === 'observe' && t('01 / 看看熊貓怎麼算折扣')}
              {session.stage === 'hypothesize' && t('02 / 提出你的猜想')}
              {session.stage === 'experiment' && t('03 / 換個價格，檢查猜想')}
              {session.stage === 'teach' && t('04 / 用正確價格教牠')}
              {session.stage === 'verify' && t('05 / 新商品，也算得對嗎？')}
              {session.stage === 'complete' && t('DiscountPanda 畢業了！')}
            </h2>
            {feedback && (
              <div
                className="ff-feedback"
                id={feedbackId}
                data-kind={feedback.kind}
                role={feedback.kind === 'error' ? 'alert' : 'status'}
              >
                <span className="ff-feedback-icon" aria-hidden="true">
                  {feedback.kind === 'error'
                    ? '!'
                    : feedback.kind === 'success'
                      ? '✓'
                      : 'i'}
                </span>
                <p>{localizeFeedback(feedback, locale, robotName, feedbackParameters)}</p>
              </div>
            )}

            {session.stage === 'observe' && (
              <>
                <p className="ff-description">
                  {t('熊貓接到一張連續減價的價目表。先看看牠的報價，再觀察牠怎麼推理。')}
                </p>
                <div className="ff-observation">
                  <InputSummary input={observationInput} />
                  <PriceQuote
                    label={t('熊貓的報價')}
                    value={evaluateRule(session.currentRuleId, observationInput).answer}
                  />
                </div>
                <ReasoningDialogue
                  evaluation={evaluateRule(session.currentRuleId, observationInput)}
                />
                <p className="ff-prompt">
                  {t('第一次減價之後，第二次的百分比應該乘上哪個價格？')}
                </p>
                <button
                  className="ff-button"
                  type="button"
                  onClick={() => apply(beginHypothesis(session))}
                >
                  {t('我觀察好了，提出猜想')}
                </button>
              </>
            )}

            {session.stage === 'hypothesize' && (
              <>
                <p className="ff-description">
                  {t(
                    '從報價和推理中，找出牠可能使用的規則。猜想可以不對，接下來用實驗檢查。',
                  )}
                </p>
                <InputSummary input={observationInput} />
                <PriceQuote
                  label={t('觀察到的熊貓報價')}
                  value={evaluateRule(session.currentRuleId, observationInput).answer}
                />
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (hypothesis) apply(chooseHypothesis(session, hypothesis));
                  }}
                >
                  <fieldset>
                    <legend className="sr-only">{t('選擇熊貓可能的錯誤規則')}</legend>
                    <div className="ff-choice-list">
                      {(['add-discounts', 'only-second'] as const).map((id) => (
                        <label className="ff-choice" key={id}>
                          <input
                            type="radio"
                            name="dp-hypothesis"
                            value={id}
                            checked={hypothesis === id}
                            onChange={() => setHypothesis(id)}
                          />
                          <span>
                            <strong>{ruleCopy[id].title}</strong>
                            <small>{ruleCopy[id].description}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button className="ff-button" type="submit" disabled={!hypothesis}>
                    {t('帶著猜想做實驗')}
                  </button>
                </form>
              </>
            )}

            {session.stage === 'experiment' && (
              <>
                <p className="ff-description">
                  {t(
                    '自己設定原價與兩次減價，看看牠的報價是否合理。一般實驗會顯示正確結果，但不會淘汰候選。',
                  )}
                </p>
                <form
                  onSubmit={submitExperiment}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <PriceFields
                    value={experimentDraft}
                    onChange={setExperimentDraft}
                    errorId={errorId}
                  />
                  <p className="ff-form-hint">
                    {t(
                      '原價為 0 至 1,000,000 元；兩次減價各為 0 至 100%。最多兩位小數，不接受負數或科學記號。',
                    )}
                  </p>
                  <button className="ff-button" type="submit">
                    {t('測試熊貓的報價')}
                  </button>
                </form>
                {latestExperiment && (
                  <>
                    <InputSummary input={latestExperiment.input} />
                    <div className="ff-comparison">
                      <div
                        className="ff-result-box"
                        data-wrong={!latestExperiment.robotWasCorrect}
                      >
                        <PriceQuote
                          label={t('熊貓的報價')}
                          value={latestExperiment.robotEvaluation.answer}
                        />
                      </div>
                      <div className="ff-result-box">
                        <PriceQuote
                          label={t('正確的最終價格')}
                          value={latestExperiment.correctAnswer}
                        />
                      </div>
                    </div>
                    <p
                      className="ff-result-status"
                      data-wrong={!latestExperiment.robotWasCorrect}
                    >
                      {latestExperiment.robotWasCorrect
                        ? t('這次碰巧答對。換一組百分比，看看它的規則是否仍然合理。')
                        : t('報價不同！這個實驗揭露了牠的迷思。')}
                    </p>
                    <PriceStair input={latestExperiment.input} />
                    <ReasoningDialogue evaluation={latestExperiment.robotEvaluation} />
                  </>
                )}
                {session.experiments.length > 1 && (
                  <details className="ff-history">
                    <summary>
                      {t('查看實驗記錄（')}
                      {session.experiments.length}
                      {t(' 次）')}
                    </summary>
                    <ol>
                      {session.experiments.map((record) => (
                        <li key={record.id}>
                          <InputSummary input={record.input} />
                          <p>
                            {t('熊貓報價 ')}
                            {formatMoney(record.robotEvaluation.answer)}{' '}
                            {t('元；正確價格 ')}
                            {formatMoney(record.correctAnswer)}
                            {t(' 元。')}
                          </p>
                          <p>
                            {record.robotWasCorrect
                              ? t('這次報價符合，但不能單憑一次答對排除迷思。')
                              : t('這次報價不符，候選仍保留，等待正確教學證據。')}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                <div className="ff-actions">
                  <button
                    className="ff-button ff-button-secondary"
                    type="button"
                    disabled={!latestExperiment}
                    onClick={startTeaching}
                  >
                    {t('開始提供教學示例')}
                  </button>
                </div>
              </>
            )}

            {session.stage === 'teach' && (
              <>
                <p className="ff-description">
                  {t(
                    '提交商品條件與你算出的最終價格。系統會先核對答案，再檢查各候選的報價是否符合這份證據。',
                  )}
                </p>
                <form
                  onSubmit={submitTeaching}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <PriceFields
                    value={teachingDraft}
                    onChange={setTeachingDraft}
                    errorId={errorId}
                  />
                  <AnswerField
                    label={t('教學答案（元）')}
                    value={teachingAnswer}
                    onChange={setTeachingAnswer}
                    errorId={errorId(['proposedAnswer'])}
                  />
                  <p className="ff-form-hint">
                    {t(
                      '只在最後四捨五入到兩位小數。整數、1 位或 2 位小數都接受；錯誤價格不能成為證據。',
                    )}
                  </p>
                  <button className="ff-button" type="submit">
                    {t('提交正確示例')}
                  </button>
                </form>
                {latestEvidence && (
                  <div className="ff-evidence-latest">
                    <h3>{t('最近一次有效示例')}</h3>
                    <InputSummary input={latestEvidence.input} />
                    <PriceQuote
                      label={t('已核對的教學答案')}
                      value={latestEvidence.proposedAnswer}
                    />
                    <ul className="ff-evidence-comparisons">
                      {latestEvidence.comparisons.map((comparison) => (
                        <li key={comparison.ruleId}>
                          <strong>{ruleCopy[comparison.ruleId].title}</strong>
                          <span>
                            {formatMoney(comparison.evaluation.answer)}
                            {t(' 元')}
                          </span>
                          <span data-compatible={comparison.compatible}>
                            {comparison.compatible ? t('符合，保留') : t('不符合，排除')}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <details className="dp-rule-traces">
                      <summary>{t('查看這次候選規則的推理')}</summary>
                      {latestEvidence.comparisons.map((comparison) => (
                        <div key={comparison.ruleId}>
                          <h4>{ruleCopy[comparison.ruleId].title}</h4>
                          <ol>
                            {explainLocalizedEvaluation(
                              comparison.evaluation,
                              locale,
                            ).map((line, index) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </details>
                    <p>
                      {latestEvidence.eliminatedRuleIds.length > 0
                        ? t('已排除：{v0}', {
                            v0: latestEvidence.eliminatedRuleIds
                              .map((id) => ruleCopy[id].title)
                              .join(t('、')),
                          })
                        : readyToVerify
                          ? t('示例已記錄；只剩正確規則，可以開始最終驗證。')
                          : t(
                              '這份正確示例沒有排除候選。試試更能區分規則的價格與百分比。',
                            )}
                    </p>
                    <PriceStair input={latestEvidence.input} />
                  </div>
                )}
                {session.evidence.length > 0 && (
                  <details className="ff-history">
                    <summary>
                      {t('查看教學記錄（')}
                      {session.evidence.length}
                      {t(' 個有效示例）')}
                    </summary>
                    <ol>
                      {session.evidence.map((record) => (
                        <li key={record.id}>
                          <InputSummary input={record.input} />
                          <p>
                            {t('最終價格：')}
                            {formatMoney(record.proposedAnswer)}
                            {t(' 元')}
                          </p>
                          <p>
                            {record.eliminatedRuleIds.length === 0
                              ? t('未排除規則')
                              : t('排除 {v0}', {
                                  v0: record.eliminatedRuleIds
                                    .map((id) => ruleCopy[id].title)
                                    .join(t('、')),
                                })}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                <p className="ff-prompt">
                  {readyToVerify
                    ? t('只剩依序折扣規則了。接著用三件未見商品，一起驗證理解。')
                    : t(
                        '只剩正確規則時才能驗證。試試兩次都不為零的折扣，找出能區分迷思的證據。',
                      )}
                </p>
                <button
                  className="ff-button"
                  type="button"
                  disabled={!readyToVerify}
                  onClick={() => apply(beginVerification(session))}
                >
                  {t('開始最終驗證')}
                </button>
              </>
            )}

            {session.stage === 'verify' && (
              <>
                <p className="ff-description">
                  {t(
                    '這三道題目沒有在觀察、實驗或有效教學示例中出現。你先報價，熊貓也必須用最後留下的規則算對。',
                  )}
                </p>
                <div
                  className="ff-verify-progress"
                  aria-label={t('已完成 {v0} / 3 題', {
                    v0: session.verificationAnswers.length,
                  })}
                >
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      data-done={index < session.verificationAnswers.length}
                    >
                      {index < session.verificationAnswers.length ? '✓' : index + 1}
                    </span>
                  ))}
                </div>
                {question && (
                  <form
                    onSubmit={submitVerification}
                    onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                  >
                    <div className="ff-verification-question">
                      <p>
                        {t('遷移測試 ')}
                        {session.verificationAnswers.length + 1} / 3
                      </p>
                      <InputSummary input={question.input} />
                    </div>
                    <AnswerField
                      label={t('驗證答案（元）')}
                      value={verificationAnswer}
                      onChange={setVerificationAnswer}
                      errorId={errorId(['proposedAnswer'])}
                    />
                    <p className="ff-form-hint">
                      {t(
                        '按同一個計算方式，求出最終價格。答錯可以修改，已完成的題目不會重複計分。',
                      )}
                    </p>
                    <button className="ff-button" type="submit">
                      {t('提交驗證答案')}
                    </button>
                  </form>
                )}
                {session.verificationAnswers.length > 0 &&
                  (() => {
                    const previous =
                      session.verification[session.verificationAnswers.length - 1];
                    return previous ? (
                      <div className="ff-verification-result">
                        <h3>{t('上一題 · 你和熊貓都答對了')}</h3>
                        <PriceQuote
                          label={t('最終價格')}
                          value={previous.correctAnswer}
                        />
                        <PriceStair input={previous.input} />
                        <ReasoningDialogue evaluation={previous.robotEvaluation} />
                      </div>
                    ) : null;
                  })()}
              </>
            )}

            {session.stage === 'complete' && (
              <>
                <div className="ff-complete-symbol" aria-hidden="true">
                  ✳
                </div>
                <p className="ff-description">
                  {t(
                    '你用正確價格排除了兩種迷思；熊貓用依序折扣規則算對了三道新題，你也完成全部驗證。在這組已知候選中，證據留下了正確規則。',
                  )}
                </p>
                <div className="ff-completion-stats">
                  <div>
                    <strong>2</strong>
                    <span>{t('錯誤規則已排除')}</span>
                  </div>
                  <div>
                    <strong>3 / 3</strong>
                    <span>{t('你與熊貓答對')}</span>
                  </div>
                  <div>
                    <strong>{session.evidence.length}</strong>
                    <span>{t('有效教學示例')}</span>
                  </div>
                </div>
                <div className="ff-completion-answers">
                  {session.verification.map((item, index) => (
                    <div key={item.id}>
                      <p>
                        {t('遷移測試 ')}
                        {index + 1}
                        {t(' · 學生與熊貓驗證通過')}
                      </p>
                      <InputSummary input={item.input} />
                      <PriceQuote label={t('最終價格')} value={item.correctAnswer} />
                    </div>
                  ))}
                </div>
                <div className="ff-actions">
                  <button className="ff-button" type="button" onClick={restart}>
                    {t('再教一次')}
                  </button>
                  <a className="ff-button ff-button-secondary" href="#">
                    {t('返回 BugZoo 首頁')}
                  </a>
                </div>
              </>
            )}
          </section>
          <CandidatePanel session={session} />
        </div>
      </main>
      <ConfirmationDialog
        open={restartOpen}
        title={t('重設課程')}
        description={t('要重置這個課程嗎？已保存的教學進度將被清除。')}
        confirmLabel={t('確認重設')}
        onConfirm={performRestart}
        onCancel={() => setRestartOpen(false)}
      />
      <footer className="ff-footer page-width">
        {t('每次回答都來自可解釋的規則。課程進度保存在這台裝置。')}
      </footer>
    </div>
  );
}

import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { fieldErrorId } from '../../components/fieldFeedback';
import type { Locale } from '../../i18n';
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
  formatProbability,
  isReadyForVerification,
  observationInput,
  parseChanceInput,
  runExperiment,
  teachExample,
  validationIssueMessage,
} from '../../domain/chanceCrow/engine';
import type {
  ChanceInput,
  Color,
  RawChanceInput,
  RuleId,
  SessionState,
} from '../../domain/chanceCrow/engine';
import type { Rational } from '../../domain/math/rational';
import { FractionFields } from '../fractionFox/FractionFields';
import type { FractionDraft } from '../fractionFox/FractionFields';
import { FractionValue } from '../fractionFox/FractionVisual';
import { ProbabilityLab } from './ProbabilityLab';
import '../../components/lesson.css';
import './chance-crow.css';

const colorNames: Record<Color, string> = { red: '紅球', blue: '藍球' };
function useRuleCopy(): Record<RuleId, { title: string; description: string }> {
  const { t } = useI18n();
  return {
    correct: {
      title: t('正確：更新球袋再相乘'),
      description: t('第一次的機率，乘上抽走第一球之後第二次的條件機率。'),
    },
    independent: {
      title: t('迷思 A：兩次都當成獨立'),
      description: t('兩次都沿用原本的球數與分母，忽略不放回使球袋改變。'),
    },
    'second-only': {
      title: t('迷思 B：把單次當成兩次'),
      description: t('把第二次指定顏色的單次邊際機率，當成兩次按順序都符合的事件機率。'),
    },
  };
}
const ruleIds: readonly RuleId[] = ['correct', 'independent', 'second-only'];

function initialDraft(): RawChanceInput {
  return { red: '3', blue: '2', first: 'red', second: 'blue' };
}

function emptyAnswer(): FractionDraft {
  return { numerator: '', denominator: '' };
}

function toDraft(input: ChanceInput): RawChanceInput {
  return {
    red: input.red.toString(),
    blue: input.blue.toString(),
    first: input.first,
    second: input.second,
  };
}

function eventLabel(input: ChanceInput, locale: Locale): string {
  return `${translateKnownText(locale, colorNames[input.first])} → ${translateKnownText(locale, colorNames[input.second])}`;
}

function InputSummary({ input }: { input: ChanceInput }) {
  const { t, locale } = useI18n();

  return (
    <div className="cc-input-summary">
      <p>
        <span className="cc-color-tag" data-color="red">
          {t('紅球 ')}
          {input.red.toString()}
          {t(' 顆')}
        </span>
        <span className="cc-color-tag" data-color="blue">
          {t('藍球 ')}
          {input.blue.toString()}
          {t(' 顆')}
        </span>
      </p>
      <p className="cc-event">
        {t('目標順序：')}
        {eventLabel(input, locale)}
        <span>{t('抽出後不放回')}</span>
      </p>
    </div>
  );
}

function ProbabilityResult({
  input,
  answer,
  label,
}: {
  input: ChanceInput;
  answer: Rational;
  label: string;
}) {
  const { locale } = useI18n();

  return (
    <div className="cc-probability-result">
      <p>{translateKnownText(locale, label)}</p>
      <div>
        <span>P({eventLabel(input, locale)}) =</span>
        <FractionValue value={answer} />
      </div>
    </div>
  );
}

function BagFields({
  value,
  onChange,
  errorId,
}: {
  value: RawChanceInput;
  onChange: (value: RawChanceInput) => void;
  errorId: (path: readonly string[]) => string | undefined;
}) {
  const { t } = useI18n();

  const fieldsId = useId();
  return (
    <div className="cc-fields">
      <div className="cc-field">
        <label htmlFor={`${fieldsId}-red`}>{t('紅球數量')}</label>
        <input
          aria-invalid={errorId(['input', 'red']) ? true : undefined}
          aria-describedby={errorId(['input', 'red'])}
          autoComplete="off"
          id={`${fieldsId}-red`}
          inputMode="numeric"
          maxLength={16}
          onChange={(event) => onChange({ ...value, red: event.currentTarget.value })}
          spellCheck={false}
          type="text"
          value={value.red}
        />
      </div>
      <div className="cc-field">
        <label htmlFor={`${fieldsId}-blue`}>{t('藍球數量')}</label>
        <input
          aria-invalid={errorId(['input', 'blue']) ? true : undefined}
          aria-describedby={errorId(['input', 'blue'])}
          autoComplete="off"
          id={`${fieldsId}-blue`}
          inputMode="numeric"
          maxLength={16}
          onChange={(event) => onChange({ ...value, blue: event.currentTarget.value })}
          spellCheck={false}
          type="text"
          value={value.blue}
        />
      </div>
      {(['first', 'second'] as const).map((key) => (
        <div className="cc-field" key={key}>
          <label htmlFor={`${fieldsId}-${key}`}>
            {key === 'first' ? t('第一次目標顏色') : t('第二次目標顏色')}
          </label>
          <select
            id={`${fieldsId}-${key}`}
            onChange={(event) => {
              const color = event.currentTarget.value;
              if (color === 'red' || color === 'blue')
                onChange({ ...value, [key]: color });
            }}
            value={value[key]}
          >
            <option value="red">{t('紅球')}</option>
            <option value="blue">{t('藍球')}</option>
          </select>
        </div>
      ))}
    </div>
  );
}

function ReasoningDialogue({ evaluation }: { evaluation: RuleEvaluation<Rational> }) {
  const { t, locale } = useI18n();

  return (
    <div className="ff-dialogue">
      <RobotPortrait kind="crow" className="ff-dialogue-portrait" />
      <div>
        <p>{t('ChanceCrow 的推理')}</p>
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
    <aside className="ff-sidebar" aria-label={t('候選規則與機率提示')}>
      <section className="ff-panel" aria-labelledby="cc-candidates-title">
        <h2 id="cc-candidates-title">{t('候選規則')}</h2>
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
          {t(
            '猜想、球袋操作與一般實驗都不會淘汰候選。只有核對正確的教學示例，才會更新規則。',
          )}
        </p>
      </section>
      <section className="ff-panel" aria-labelledby="cc-tip-title">
        <h2 id="cc-tip-title">{t('樹屋裡的小提示')}</h2>
        <p className="ff-sidebar-note">
          {t(
            '題目要的是兩次按順序都符合的機率。第一球抽走之後，總球數和某種顏色的球數會怎麼變？',
          )}
        </p>
        <p className="ff-sidebar-note">
          {t('單次邊際機率本身可以正確；把它用來回答整個兩次事件，才是迷思 B 的問題。')}
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

function feedbackTitle(code: string): string {
  switch (code) {
    case 'invalid-input':
      return '輸入未通過驗證';
    case 'incorrect-example':
      return '教學機率需要修正';
    case 'non-discriminating':
      return '答案正確，還不能區分規則';
    case 'rules-eliminated':
      return '有效反例已更新候選';
    case 'ready-verification':
      return '正確示例已記錄';
    case 'incorrect-verification':
      return '驗證答案可以修改後重試';
    case 'lesson-complete':
      return '你與烏鴉都通過了驗證';
    default:
      return '教學回饋';
  }
}

export function ChanceCrowGame() {
  const { t, locale } = useI18n();
  const ruleCopy = useRuleCopy();

  const [session, setSession] = useLessonProgress('chancecrow', createSession);
  const robotName = 'ChanceCrow';
  const feedbackParameters = {
    prediction: session.hypothesis
      ? formatProbability(evaluateRule(session.hypothesis, observationInput).answer)
      : '?',
    observed: formatProbability(
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
  const [teachingAnswer, setTeachingAnswer] = useState(emptyAnswer);
  const [verificationAnswer, setVerificationAnswer] = useState(emptyAnswer);
  const [labRevision, setLabRevision] = useState(0);
  const [restartOpen, setRestartOpen] = useState(false);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const latestExperiment = session.experiments.at(-1);
  const latestEvidence = session.evidence.at(-1);
  const question = session.verification[session.verificationAnswers.length];
  const previousQuestion = session.verification[session.verificationAnswers.length - 1];
  const readyToVerify = isReadyForVerification(session);
  const experimentPreview = parseChanceInput(experimentDraft);
  const counterexampleCount = session.evidence.filter(
    (record) => record.eliminatedRuleIds.length > 0,
  ).length;

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
    progressStore.resetLesson('chancecrow');
    setFeedback(null);
    setHypothesis(null);
    setExperimentDraft(initialDraft());
    setTeachingDraft(initialDraft());
    setTeachingAnswer(emptyAnswer());
    setVerificationAnswer(emptyAnswer());
    setLabRevision((revision) => revision + 1);
  }

  function startTeaching() {
    const result = beginTeaching(session);
    apply(result);
    if (result.state.stage === 'teach' && latestExperiment)
      setTeachingDraft(toDraft(latestExperiment.input));
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
    if (result.state.verificationAnswers.length > session.verificationAnswers.length)
      setVerificationAnswer(emptyAnswer());
  }

  return (
    <div className="ff-game cc-game">
      <a className="skip-link" href="#chancecrow-content">
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
            onClick={restart}
            type="button"
          >
            {t('重新開始')}
          </button>
        </div>
      </header>
      <main id="chancecrow-content" className="page-width" tabIndex={-1}>
        <div className="ff-lesson-intro">
          <RobotPortrait kind="crow" className="ff-intro-portrait" />
          <div>
            <p className="ff-kicker">{t('LESSON 04 / 不放回抽樣機率')}</p>
            <h1>{t('ChanceCrow 的球袋實驗室')}</h1>
            <p>{t('抽出一球，留在外面。用條件與反例，教牠看清下一次的球袋。')}</p>
          </div>
        </div>
        <div className="cc-concept-intro">
          <strong>{t('這次要算的是兩次事件')}</strong>
          <p>
            {t(
              '按指定順序抽兩球，抽出後不放回。目標是「第一次符合，而且第二次也符合」的聯合機率；不是只看其中一球。',
            )}
          </p>
        </div>
        <LessonProgress stage={session.stage} />
        <div className="ff-workspace">
          <section className="ff-panel" aria-labelledby="cc-stage-title">
            <h2
              className="ff-stage-heading"
              id="cc-stage-title"
              ref={stageHeading}
              tabIndex={-1}
            >
              {session.stage === 'observe' && t('01 / 烏鴉忘了球袋會改變')}
              {session.stage === 'hypothesize' && t('02 / 提出你的猜想')}
              {session.stage === 'experiment' && t('03 / 改變球袋，檢查猜想')}
              {session.stage === 'teach' && t('04 / 用正確機率教牠')}
              {session.stage === 'verify' && t('05 / 新球袋，條件還看得懂嗎？')}
              {session.stage === 'complete' && t('ChanceCrow 看懂兩次抽樣了！')}
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
                <div>
                  <strong className="cc-feedback-title">
                    {translateKnownText(locale, feedbackTitle(feedback.code))}
                  </strong>
                  <p>
                    {localizeFeedback(feedback, locale, robotName, feedbackParameters)}
                  </p>
                </div>
              </div>
            )}

            {session.stage === 'observe' && (
              <>
                <p className="ff-description">
                  {t(
                    '烏鴉看著球袋，卻把兩次抽樣當成互不影響。先讀牠的推理，再親手抽一球，看球袋是否仍然一樣。',
                  )}
                </p>
                <InputSummary input={observationInput} />
                <ProbabilityResult
                  input={observationInput}
                  answer={evaluateRule(session.currentRuleId, observationInput).answer}
                  label={t('烏鴉的計算')}
                />
                <ReasoningDialogue
                  evaluation={evaluateRule(session.currentRuleId, observationInput)}
                />
                <ProbabilityLab
                  input={observationInput}
                  key={`observe-${labRevision}`}
                  label={t('觀察不放回的球袋')}
                />
                <p className="ff-prompt">
                  {t('第一球拿出後，第二次還能沿用原來的分子與分母嗎？')}
                </p>
                <button
                  className="ff-button"
                  onClick={() => apply(beginHypothesis(session))}
                  type="button"
                >
                  {t('我觀察好了，提出猜想')}
                </button>
              </>
            )}

            {session.stage === 'hypothesize' && (
              <>
                <p className="ff-description">
                  {t(
                    '哪條規則能解釋牠的答案？猜對或猜錯都不會淘汰候選，接下來設計實驗。',
                  )}
                </p>
                <InputSummary input={observationInput} />
                <ProbabilityResult
                  input={observationInput}
                  answer={evaluateRule(session.currentRuleId, observationInput).answer}
                  label={t('觀察到的計算')}
                />
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (hypothesis) apply(chooseHypothesis(session, hypothesis));
                  }}
                >
                  <fieldset>
                    <legend className="sr-only">{t('選擇烏鴉可能的錯誤規則')}</legend>
                    <div className="ff-choice-list">
                      {(['independent', 'second-only'] as const).map((id) => (
                        <label className="ff-choice" key={id}>
                          <input
                            checked={hypothesis === id}
                            name="cc-hypothesis"
                            onChange={() => setHypothesis(id)}
                            type="radio"
                            value={id}
                          />
                          <span>
                            <strong>{ruleCopy[id].title}</strong>
                            <small>{ruleCopy[id].description}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button className="ff-button" disabled={!hypothesis} type="submit">
                    {t('帶著猜想做實驗')}
                  </button>
                </form>
              </>
            )}

            {session.stage === 'experiment' && (
              <>
                <p className="ff-description">
                  {t(
                    '設定紅球、藍球與兩次目標顏色。合法草稿會即時更新實驗室；提交實驗才會記錄烏鴉與正確規則的答案。',
                  )}
                </p>
                <form
                  onSubmit={submitExperiment}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <BagFields
                    value={experimentDraft}
                    onChange={setExperimentDraft}
                    errorId={errorId}
                  />
                  <p className="ff-form-hint">
                    {t(
                      '每種顏色可有 0 至 10 顆，總數必須為 2 至 12 顆。球數只接受整數；選不到的目標顏色會形成合法的零機率事件。',
                    )}
                  </p>
                  <button className="ff-button" type="submit">
                    {t('測試烏鴉的答案')}
                  </button>
                </form>
                <section className="cc-preview" aria-labelledby="cc-preview-title">
                  <h3 id="cc-preview-title">{t('目前草稿的球袋預覽')}</h3>
                  {experimentPreview.ok ? (
                    <>
                      <p className="ff-form-hint">
                        {t(
                          '改變球袋設定，抽樣紀錄會重新開始；操作球袋不會自動記入教學證據。',
                        )}
                      </p>
                      <ProbabilityLab
                        input={experimentPreview.value}
                        key={`preview-${labRevision}`}
                        label={t('目前草稿的機率實驗室')}
                      />
                    </>
                  ) : (
                    <div className="cc-preview-invalid" role="status">
                      <strong>{t('預覽暫停，請先修正球袋設定')}</strong>
                      <ul>
                        {experimentPreview.issues.map((issue, index) => (
                          <li key={index}>
                            {translateKnownText(locale, validationIssueMessage(issue))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
                {latestExperiment && (
                  <>
                    <h3 className="cc-result-heading">{t('最近一次已提交的實驗')}</h3>
                    <InputSummary input={latestExperiment.input} />
                    <div className="ff-comparison">
                      <div
                        className="ff-result-box"
                        data-wrong={!latestExperiment.robotWasCorrect}
                      >
                        <ProbabilityResult
                          input={latestExperiment.input}
                          answer={latestExperiment.robotEvaluation.answer}
                          label={t('烏鴉的答案')}
                        />
                      </div>
                      <div className="ff-result-box">
                        <ProbabilityResult
                          input={latestExperiment.input}
                          answer={latestExperiment.correctAnswer}
                          label={t('精確正確答案')}
                        />
                      </div>
                    </div>
                    <p
                      className="ff-result-status"
                      data-wrong={!latestExperiment.robotWasCorrect}
                    >
                      {latestExperiment.robotWasCorrect
                        ? t(
                            '答案碰巧相同。試試同色、異色或零機率事件，看看哪些規則仍然相容。',
                          )
                        : t('答案不同！這個實驗揭露了牠對兩次抽樣的迷思。')}
                    </p>
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
                            {t('烏鴉答 ')}
                            {formatProbability(record.robotEvaluation.answer)}
                            {t('；正確機率 ')}
                            {formatProbability(record.correctAnswer)}
                            {t('。')}
                          </p>
                          <p>
                            {record.robotWasCorrect
                              ? t('本題答案符合，但尚不能因此淘汰候選。')
                              : t('本題答案不符，等待正確教學證據。')}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                <div className="ff-actions">
                  <button
                    className="ff-button ff-button-secondary"
                    disabled={!latestExperiment}
                    onClick={startTeaching}
                    type="button"
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
                    '用一份正確示例，讓各條規則接受同樣的證據檢查。請回答完整的兩次按順序事件，而不是單次抽到某色的機率。',
                  )}
                </p>
                <form
                  onSubmit={submitTeaching}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <BagFields
                    value={teachingDraft}
                    onChange={setTeachingDraft}
                    errorId={errorId}
                  />
                  <div className="cc-answer-field">
                    <FractionFields
                      label={t('教學答案')}
                      value={teachingAnswer}
                      onChange={setTeachingAnswer}
                      errorId={(field) => errorId(['proposedAnswer', field])}
                    />
                  </div>
                  <p className="ff-form-hint">
                    {t(
                      '使用 0 到 1 的精確分數，分母必須為正。等價分數都接受；輸入不合法或答案不正確，都不會更新候選。',
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
                    <ProbabilityResult
                      input={latestEvidence.input}
                      answer={latestEvidence.proposedAnswer}
                      label={t('已核對的聯合機率')}
                    />
                    <ul className="ff-evidence-comparisons">
                      {latestEvidence.comparisons.map((comparison) => (
                        <li key={comparison.ruleId}>
                          <strong>{ruleCopy[comparison.ruleId].title}</strong>
                          <span>{formatProbability(comparison.evaluation.answer)}</span>
                          <span data-compatible={comparison.compatible}>
                            {comparison.compatible ? t('符合，保留') : t('不符合，排除')}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p>
                      {latestEvidence.eliminatedRuleIds.length > 0
                        ? t('已排除：{v0}', {
                            v0: latestEvidence.eliminatedRuleIds
                              .map((id) => ruleCopy[id].title)
                              .join(t('、')),
                          })
                        : readyToVerify
                          ? t('示例已記錄；只剩正確規則，可以開始驗證。')
                          : t(
                              '答案正確，但存活規則在這題恰好相同。請設計更能區分的反例。',
                            )}
                    </p>
                    <details className="cc-rule-traces">
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
                    <ProbabilityLab
                      input={latestEvidence.input}
                      key={`evidence-${labRevision}`}
                      label={t('有效教學示例的球袋推演')}
                    />
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
                            {t('聯合機率：')}
                            {formatProbability(record.proposedAnswer)}
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
                    ? t('只剩更新球袋的規則了。接著用三個新情境，讓你和烏鴉一起驗證。')
                    : t(
                        '只剩正確規則時才能驗證。試試不同顏色的球袋與抽取順序，找出有辨識力的反例。',
                      )}
                </p>
                <button
                  className="ff-button"
                  disabled={!readyToVerify}
                  onClick={() => apply(beginVerification(session))}
                  type="button"
                >
                  {t('開始最終驗證')}
                </button>
              </>
            )}

            {session.stage === 'verify' && (
              <>
                <p className="ff-description">
                  {t(
                    '這三題使用新的球袋與目標順序，沒有出現在觀察、有效實驗或教學示例中。先自己算出機率；答對後才揭示球袋推演。',
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
                      <p className="cc-question-prompt">
                        P({eventLabel(question.input, locale)}) = ?
                      </p>
                    </div>
                    <div className="cc-answer-field">
                      <FractionFields
                        label={t('驗證答案')}
                        value={verificationAnswer}
                        onChange={setVerificationAnswer}
                        errorId={(field) => errorId(['proposedAnswer', field])}
                      />
                    </div>
                    <p className="ff-form-hint">
                      {t('請填 0 到 1 的精確分數；答錯可以修改後重試。')}
                    </p>
                    <button className="ff-button" type="submit">
                      {t('提交驗證答案')}
                    </button>
                  </form>
                )}
                {previousQuestion && (
                  <div className="ff-verification-result">
                    <h3>{t('上一題 · 你和烏鴉都答對了')}</h3>
                    <InputSummary input={previousQuestion.input} />
                    <ProbabilityResult
                      input={previousQuestion.input}
                      answer={previousQuestion.correctAnswer}
                      label={t('上一題的正確機率')}
                    />
                    <ReasoningDialogue evaluation={previousQuestion.robotEvaluation} />
                    <ProbabilityLab
                      input={previousQuestion.input}
                      key={`verified-${labRevision}`}
                      label={t('上一題答對後的球袋推演')}
                    />
                  </div>
                )}
              </>
            )}

            {session.stage === 'complete' && (
              <>
                <div className="ff-complete-symbol" aria-hidden="true">
                  ↗
                </div>
                <p className="ff-description">
                  {t(
                    '你用反例排除了兩種迷思，並和烏鴉一起答對三道未見題。在本課程的已知候選中，證據留下了正確規則。',
                  )}
                </p>
                <div className="ff-completion-stats">
                  <div>
                    <strong>{session.experiments.length}</strong>
                    <span>{t('次有效實驗')}</span>
                  </div>
                  <div>
                    <strong>{counterexampleCount}</strong>
                    <span>{t('個有效反例')}</span>
                  </div>
                  <div>
                    <strong>3 / 3</strong>
                    <span>{t('你與烏鴉答對')}</span>
                  </div>
                </div>
                <section className="cc-concept-recap" aria-labelledby="cc-recap-title">
                  <h3 id="cc-recap-title">{t('你教會牠的兩個觀念')}</h3>
                  <ul>
                    <li>
                      <strong>{t('不放回，第二次的條件會改變。')}</strong>
                      {t('先算第一次，再根據抽走第一球的球袋算第二次，將兩者相乘。')}
                    </li>
                    <li>
                      <strong>{t('單次機率不等於兩次事件。')}</strong>
                      {t('單次邊際機率可能正確，但不能直接代替有順序的聯合機率。')}
                    </li>
                  </ul>
                  <p>
                    {t('已排除：')}
                    {ruleIds
                      .filter(
                        (id) =>
                          id !== 'correct' && !session.candidateRuleIds.includes(id),
                      )
                      .map((id) => ruleCopy[id].title)
                      .join(t('、'))}
                    {t('。')}
                  </p>
                  <p>
                    {t(
                      '有效反例只計算已核對正確、且排除至少一條候選的教學示例；抽樣頻率不是教學答案的核對依據。',
                    )}
                  </p>
                </section>
                <div className="ff-completion-answers">
                  {session.verification.map((item, index) => (
                    <div key={item.id}>
                      <p>
                        {t('遷移測試 ')}
                        {index + 1}
                        {t(' · 學生與烏鴉驗證通過')}
                      </p>
                      <InputSummary input={item.input} />
                      <ProbabilityResult
                        input={item.input}
                        answer={item.correctAnswer}
                        label={t('精確聯合機率')}
                      />
                      <details className="cc-rule-traces">
                        <summary>{t('回看這題的球袋')}</summary>
                        <ProbabilityLab
                          input={item.input}
                          key={`complete-${index}-${labRevision}`}
                          label={t('遷移測試 {v0} 的球袋推演', { v0: index + 1 })}
                        />
                      </details>
                    </div>
                  ))}
                </div>
                <div className="ff-actions">
                  <button className="ff-button" onClick={restart} type="button">
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

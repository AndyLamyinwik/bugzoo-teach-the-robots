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
  formatInteger,
  isReadyForVerification,
  observationInput,
  runExperiment,
  teachExample,
} from '../../domain/minusMole/engine';
import type {
  RawSubtractionInput,
  RuleId,
  SessionState,
  SubtractionInput,
} from '../../domain/minusMole/engine';
import { NumberLine } from './NumberLine';
import '../../components/lesson.css';
import './minus-mole.css';

function useRuleCopy(): Record<RuleId, { title: string; description: string }> {
  const { t } = useI18n();
  return {
    correct: {
      title: t('正確：加上相反數'),
      description: t('減去一個數，就加上它的相反數；減去負數時向右移動。'),
    },
    'subtract-absolute': {
      title: t('迷思 A：忽略減數的負號'),
      description: t('總是減去第二個數的絕對值，遇到負數仍往左走。'),
    },
    'absolute-result': {
      title: t('迷思 B：答案不會是負數'),
      description: t('計算後又把答案取絕對值，丟掉負數結果的符號。'),
    },
  };
}
const ruleIds: readonly RuleId[] = ['correct', 'subtract-absolute', 'absolute-result'];

function initialDraft(): RawSubtractionInput {
  return { a: '5', b: '-3' };
}

function toDraft(input: SubtractionInput): RawSubtractionInput {
  return { a: formatInteger(input.a), b: formatInteger(input.b) };
}

function equationText(input: SubtractionInput): string {
  return `${formatInteger(input.a)} − (${formatInteger(input.b)})`;
}

function SubtractionEquation({
  input,
  answer,
  label,
}: {
  input: SubtractionInput;
  answer?: bigint;
  label?: string;
}) {
  const { locale } = useI18n();

  return (
    <div className="mm-equation">
      {label && <p>{translateKnownText(locale, label)}</p>}
      <strong>
        {equationText(input)} = {answer === undefined ? '?' : formatInteger(answer)}
      </strong>
    </div>
  );
}

function IntegerField({
  label,
  value,
  onChange,
  hint,
  errorId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  errorId: string | undefined;
}) {
  const { locale } = useI18n();

  const inputId = useId();
  return (
    <div className="mm-field">
      <label htmlFor={inputId}>{translateKnownText(locale, label)}</label>
      <input
        aria-invalid={errorId ? true : undefined}
        aria-describedby={
          [hint ? `${inputId}-hint` : '', errorId].filter(Boolean).join(' ') || undefined
        }
        autoComplete="off"
        id={inputId}
        inputMode="text"
        maxLength={16}
        onChange={(event) => onChange(event.currentTarget.value)}
        spellCheck={false}
        type="text"
        value={value}
      />
      {hint && <p id={`${inputId}-hint`}>{hint}</p>}
    </div>
  );
}

function SubtractionFields({
  value,
  onChange,
  errorId,
}: {
  value: RawSubtractionInput;
  onChange: (value: RawSubtractionInput) => void;
  errorId: (path: readonly string[]) => string | undefined;
}) {
  const { t } = useI18n();

  return (
    <div className="mm-fields">
      <IntegerField
        label={t('被減數 a（起點）')}
        value={value.a}
        onChange={(a) => onChange({ ...value, a })}
        errorId={errorId(['input', 'a'])}
        hint={t('你從數線的哪裡出發？')}
      />
      <span className="mm-minus" aria-hidden="true">
        −
      </span>
      <IntegerField
        label={t('減數 b')}
        value={value.b}
        onChange={(b) => onChange({ ...value, b })}
        errorId={errorId(['input', 'b'])}
        hint={t('要減去哪個整數？保留負號。')}
      />
    </div>
  );
}

function ReasoningDialogue({ evaluation }: { evaluation: RuleEvaluation<bigint> }) {
  const { t, locale } = useI18n();

  return (
    <div className="ff-dialogue">
      <RobotPortrait kind="mole" className="ff-dialogue-portrait" />
      <div>
        <p>{t('MinusMole 的推理')}</p>
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
    <aside className="ff-sidebar" aria-label={t('候選規則與數線提示')}>
      <section className="ff-panel" aria-labelledby="mm-candidates-title">
        <h2 id="mm-candidates-title">{t('候選規則')}</h2>
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
          {t('猜想與實驗只幫助觀察；只有核對正確的教學答案，才能淘汰不符合證據的規則。')}
        </p>
      </section>
      <section className="ff-panel" aria-labelledby="mm-tip-title">
        <h2 id="mm-tip-title">{t('隧道裡的小提示')}</h2>
        <p className="ff-sidebar-note">
          {t('先看起點，再看方向。試試減去正數、減去負數，以及結果在零左邊的題目。')}
        </p>
        <p className="ff-sidebar-note">
          {t(
            '數線向右是增加，向左是減少。負答案代表位置在零的左邊，不需要把它改成正數。',
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

function feedbackTitle(code: string): string {
  switch (code) {
    case 'invalid-input':
      return '輸入未通過驗證';
    case 'incorrect-example':
      return '教學答案需要修正';
    case 'non-discriminating':
      return '答案正確，還不能區分規則';
    case 'rules-eliminated':
      return '有效反例已更新候選';
    case 'ready-verification':
      return '正確示例已記錄';
    case 'incorrect-verification':
      return '驗證答案可以修改後重試';
    case 'lesson-complete':
      return '你與鼴鼠都通過了驗證';
    default:
      return '教學回饋';
  }
}

export function MinusMoleGame() {
  const { t, locale } = useI18n();
  const ruleCopy = useRuleCopy();

  const [session, setSession] = useLessonProgress('minusmole', createSession);
  const robotName = 'MinusMole';
  const feedbackParameters = {
    prediction: session.hypothesis
      ? formatInteger(evaluateRule(session.hypothesis, observationInput).answer)
      : '?',
    observed: formatInteger(
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
  const previousQuestion = session.verification[session.verificationAnswers.length - 1];
  const readyToVerify = isReadyForVerification(session);
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
    progressStore.resetLesson('minusmole');
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
      setVerificationAnswer('');
  }

  return (
    <div className="ff-game mm-game">
      <a className="skip-link" href="#minusmole-content">
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
      <main id="minusmole-content" className="page-width" tabIndex={-1}>
        <div className="ff-lesson-intro">
          <RobotPortrait kind="mole" className="ff-intro-portrait" />
          <div>
            <p className="ff-kicker">{t('LESSON 03 / 負數減法')}</p>
            <h1>{t('MinusMole 的數線隧道')}</h1>
            <p>{t('先別急著挖。用起點、方向與反例，教會牠看懂每一步。')}</p>
          </div>
        </div>
        <div className="mm-concept-intro">
          <strong>{t('本課程的起點')}</strong>
          <p>
            {t(
              '整數減法 a − b，就是加上 b 的相反數。題目接受 −20 到 20 的整數；保留每個負號，用數線檢查方向。',
            )}
          </p>
        </div>
        <LessonProgress stage={session.stage} />
        <div className="ff-workspace">
          <section className="ff-panel" aria-labelledby="mm-stage-title">
            <h2
              className="ff-stage-heading"
              id="mm-stage-title"
              ref={stageHeading}
              tabIndex={-1}
            >
              {session.stage === 'observe' && t('01 / 跟著鼴鼠，看牠往哪裡走')}
              {session.stage === 'hypothesize' && t('02 / 提出你的猜想')}
              {session.stage === 'experiment' && t('03 / 改個數字，檢查方向')}
              {session.stage === 'teach' && t('04 / 用正確反例帶牠回到數線')}
              {session.stage === 'verify' && t('05 / 新隧道，也找得到終點嗎？')}
              {session.stage === 'complete' && t('MinusMole 找到正確方向了！')}
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
                  <strong className="mm-feedback-title">
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
                    '鼴鼠遇到一道減去負數的題目，卻繼續往左挖。先看牠的答案，再播放數線，觀察起點與移動方向。',
                  )}
                </p>
                <SubtractionEquation
                  input={observationInput}
                  answer={evaluateRule(session.currentRuleId, observationInput).answer}
                  label={t('鼴鼠的第一份作業')}
                />
                <NumberLine
                  input={observationInput}
                  ruleId={session.currentRuleId}
                  label={t('鼴鼠的數線推理')}
                />
                <ReasoningDialogue
                  evaluation={evaluateRule(session.currentRuleId, observationInput)}
                />
                <p className="ff-prompt">
                  {t(
                    '減去一個負數，應該向左，還是向右移動？先提出猜想，再用實驗找證據。',
                  )}
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
                    '哪條規則能解釋牠剛才的走法？猜錯也沒關係；猜想不會淘汰候選，接下來用實驗檢查。',
                  )}
                </p>
                <SubtractionEquation
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
                    <legend className="sr-only">{t('選擇鼴鼠可能的錯誤規則')}</legend>
                    <div className="ff-choice-list">
                      {(['subtract-absolute', 'absolute-result'] as const).map((id) => (
                        <label className="ff-choice" key={id}>
                          <input
                            checked={hypothesis === id}
                            name="mm-hypothesis"
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
                    '選一個起點與減數，看看鼴鼠會走到哪裡。實驗會比較兩種走法，但還不會改變候選規則。',
                  )}
                </p>
                <form
                  onSubmit={submitExperiment}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <SubtractionFields
                    value={experimentDraft}
                    onChange={setExperimentDraft}
                    errorId={errorId}
                  />
                  <p className="ff-form-hint">
                    {t(
                      '兩個數都必須是 −20 到 20 的整數。可輸入負數與零，不接受空白值、小數或科學記號。',
                    )}
                  </p>
                  <button className="ff-button" type="submit">
                    {t('測試鼴鼠的走法')}
                  </button>
                </form>
                {latestExperiment && (
                  <>
                    <div className="ff-comparison">
                      <div
                        className="ff-result-box"
                        data-wrong={!latestExperiment.robotWasCorrect}
                      >
                        <SubtractionEquation
                          input={latestExperiment.input}
                          answer={latestExperiment.robotEvaluation.answer}
                          label={t('鼴鼠的答案')}
                        />
                      </div>
                      <div className="ff-result-box">
                        <SubtractionEquation
                          input={latestExperiment.input}
                          answer={latestExperiment.correctAnswer}
                          label={t('正確的答案')}
                        />
                      </div>
                    </div>
                    <p
                      className="ff-result-status"
                      data-wrong={!latestExperiment.robotWasCorrect}
                    >
                      {latestExperiment.robotWasCorrect
                        ? t('答案碰巧相同。換個減數或起點，看看這條規則是否仍然合理。')
                        : t('終點不同！沿著數線，比較錯誤規則與正確走法。')}
                    </p>
                    <div className="mm-line-comparison">
                      <NumberLine
                        input={latestExperiment.input}
                        ruleId={latestExperiment.ruleId}
                        label={t('鼴鼠這次實驗的走法')}
                      />
                      <NumberLine
                        input={latestExperiment.input}
                        ruleId="correct"
                        label={t('正確的數線走法')}
                      />
                    </div>
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
                          <p>
                            {equationText(record.input)}
                            {t('：鼴鼠答')} {formatInteger(record.robotEvaluation.answer)}
                            {t('，正確答案')} {formatInteger(record.correctAnswer)}
                            {t('。')}
                          </p>
                          <p>
                            {record.robotWasCorrect
                              ? t('答案符合，仍需更多證據檢查規則。')
                              : t('答案不符，候選等待正確教學示例。')}
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
                    '你來帶路。提交一道整數減法與正確答案，讓每條候選規則接受同一份證據檢查。',
                  )}
                </p>
                <form
                  onSubmit={submitTeaching}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <SubtractionFields
                    value={teachingDraft}
                    onChange={setTeachingDraft}
                    errorId={errorId}
                  />
                  <div className="mm-answer-field">
                    <IntegerField
                      label={t('教學答案')}
                      value={teachingAnswer}
                      onChange={setTeachingAnswer}
                      errorId={errorId(['proposedAnswer'])}
                      hint={t('填入 −40 到 40 的整數；負答案要保留負號。')}
                    />
                  </div>
                  <p className="ff-form-hint">
                    {t(
                      '輸入不合法或答案不正確，都不會更新候選。答案正確也可能無法區分規則；請找出有辨識力的反例。',
                    )}
                  </p>
                  <button className="ff-button" type="submit">
                    {t('提交正確示例')}
                  </button>
                </form>
                {latestEvidence && (
                  <div className="ff-evidence-latest">
                    <h3>{t('最近一次有效示例')}</h3>
                    <SubtractionEquation
                      input={latestEvidence.input}
                      answer={latestEvidence.proposedAnswer}
                    />
                    <ul className="ff-evidence-comparisons">
                      {latestEvidence.comparisons.map((comparison) => (
                        <li key={comparison.ruleId}>
                          <strong>{ruleCopy[comparison.ruleId].title}</strong>
                          <span>
                            {t('答案 ')}
                            {formatInteger(comparison.evaluation.answer)}
                          </span>
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
                              '答案正確，但仍存活的規則在這題得到相同結果。換一個反例再試。',
                            )}
                    </p>
                    <NumberLine
                      input={latestEvidence.input}
                      ruleId="correct"
                      label={t('有效示例的正確數線')}
                    />
                    <details className="mm-rule-traces">
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
                          {comparison.ruleId !== 'correct' && (
                            <NumberLine
                              input={latestEvidence.input}
                              ruleId={comparison.ruleId}
                              label={t('{v0}的示例走法', {
                                v0: ruleCopy[comparison.ruleId].title,
                              })}
                            />
                          )}
                        </div>
                      ))}
                    </details>
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
                          <p>
                            {equationText(record.input)} ={' '}
                            {formatInteger(record.proposedAnswer)}
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
                    ? t(
                        '只剩加上相反數的規則了。接著用三道新題，讓你和鼴鼠一起驗證方向。',
                      )
                    : t(
                        '只剩正確規則時才能驗證。分別試試減去負數，以及答案是負數的題目。',
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
                    '這三題沒有在觀察、有效實驗或教學示例中出現。先自己找到終點；答對後才揭示鼴鼠的走法。',
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
                      <SubtractionEquation input={question.input} />
                    </div>
                    <div className="mm-answer-field">
                      <IntegerField
                        label={t('驗證答案')}
                        value={verificationAnswer}
                        onChange={setVerificationAnswer}
                        errorId={errorId(['proposedAnswer'])}
                        hint={t('先算出整數答案；答錯可以修正後重試。')}
                      />
                    </div>
                    <button className="ff-button" type="submit">
                      {t('提交驗證答案')}
                    </button>
                  </form>
                )}
                {previousQuestion && (
                  <div className="ff-verification-result">
                    <h3>{t('上一題 · 你和鼴鼠都答對了')}</h3>
                    <SubtractionEquation
                      input={previousQuestion.input}
                      answer={previousQuestion.correctAnswer}
                    />
                    <NumberLine
                      input={previousQuestion.input}
                      ruleId={session.currentRuleId}
                      label={t('上一題答對後的數線推理')}
                    />
                    <ReasoningDialogue evaluation={previousQuestion.robotEvaluation} />
                  </div>
                )}
              </>
            )}

            {session.stage === 'complete' && (
              <>
                <div className="ff-complete-symbol" aria-hidden="true">
                  ↔
                </div>
                <p className="ff-description">
                  {t(
                    '你用反例排除了兩種迷思，並和鼴鼠一起答對三道未見題。在本課程的已知候選中，證據留下了正確規則。',
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
                    <span>{t('你與鼴鼠答對')}</span>
                  </div>
                </div>
                <section className="mm-concept-recap" aria-labelledby="mm-recap-title">
                  <h3 id="mm-recap-title">{t('你教會牠的方向感')}</h3>
                  <ul>
                    <li>
                      <strong>{t('減去負數，改向右走。')}</strong>
                      {t('減去 b，就是加上它的相反數；不能忽略減數的負號。')}
                    </li>
                    <li>
                      <strong>{t('負答案，也是正確的位置。')}</strong>
                      {t('結果在零的左邊時，要保留負號，不能取絕對值。')}
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
                  <p>{t('有效反例只計算已核對正確、且排除至少一條候選的教學示例。')}</p>
                </section>
                <div className="ff-completion-answers">
                  {session.verification.map((item, index) => (
                    <div key={item.id}>
                      <p>
                        {t('遷移測試 ')}
                        {index + 1}
                        {t(' · 學生與鼴鼠驗證通過')}
                      </p>
                      <SubtractionEquation
                        input={item.input}
                        answer={item.correctAnswer}
                      />
                      <details className="mm-rule-traces">
                        <summary>{t('回看這題的數線')}</summary>
                        <NumberLine
                          input={item.input}
                          ruleId="correct"
                          label={t('遷移測試 {v0} 的正確走法', { v0: index + 1 })}
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

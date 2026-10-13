import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { fieldErrorId } from '../../components/fieldFeedback';
import { useLessonProgress, progressStore } from '../../progress';
import {
  explainLocalizedEvaluation,
  localizeFeedback,
} from '../../i18n/domainPresentation';
import { useI18n } from '../../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { LessonProgress } from '../../components/LessonProgress';
import { RobotPortrait } from '../../components/RobotPortrait';
import {
  answerVerification,
  beginHypothesis,
  beginTeaching,
  beginVerification,
  chooseHypothesis,
  createSession,
  evaluateRule,
  formatFraction,
  isReadyForVerification,
  observationInput,
  runExperiment,
  teachExample,
} from '../../domain/fractionFox/engine';
import type {
  DraftAddition,
  RuleId,
  SessionState,
} from '../../domain/fractionFox/engine';
import type { RuleEvaluation } from '../../domain/contracts';
import { areRationalsEqual } from '../../domain/math/rational';
import type { Rational } from '../../domain/math/rational';
import { FractionFields } from './FractionFields';
import type { FractionDraft } from './FractionFields';
import { AdditionEquation, FractionArea, FractionValue } from './FractionVisual';

function useRuleCopy(): Record<RuleId, { title: string; description: string }> {
  const { t } = useI18n();
  return {
    correct: {
      title: t('正確：通分後相加'),
      description: t('先將兩個分數化為相同單位，再相加分子。'),
    },
    'add-both': {
      title: t('迷思 A：上下都加'),
      description: t('分子相加，分母也直接相加。'),
    },
    'keep-first': {
      title: t('迷思 B：保留第一個分母'),
      description: t('分子相加，沿用第一個分數的分母。'),
    },
  };
}
const ruleIds: readonly RuleId[] = ['correct', 'add-both', 'keep-first'];

function initialDraft(): DraftAddition {
  return {
    left: { numerator: '1', denominator: '2' },
    right: { numerator: '1', denominator: '3' },
  };
}

function emptyAnswer(): FractionDraft {
  return { numerator: '', denominator: '' };
}

function ReasoningDialogue({ evaluation }: { evaluation: RuleEvaluation<Rational> }) {
  const { t, locale } = useI18n();

  return (
    <div className="ff-dialogue">
      <RobotPortrait kind="fox" className="ff-dialogue-portrait" />
      <div>
        <p>{t('FractionFox 的推理')}</p>
        <ol className="ff-reasoning">
          {explainLocalizedEvaluation(evaluation, locale).map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function AdditionFields({
  value,
  onChange,
  errorId,
}: {
  value: DraftAddition;
  onChange: (value: DraftAddition) => void;
  errorId: (path: readonly string[]) => string | undefined;
}) {
  const { t } = useI18n();

  return (
    <div className="ff-form-row">
      <FractionFields
        label={t('第一個分數')}
        value={value.left}
        onChange={(left) => onChange({ ...value, left })}
        errorId={(field) => errorId(['input', 'left', field])}
      />
      <span className="ff-form-plus" aria-hidden="true">
        +
      </span>
      <FractionFields
        label={t('第二個分數')}
        value={value.right}
        onChange={(right) => onChange({ ...value, right })}
        errorId={(field) => errorId(['input', 'right', field])}
      />
    </div>
  );
}

function CandidatePanel({ session }: { session: SessionState }) {
  const { t } = useI18n();
  const ruleCopy = useRuleCopy();

  return (
    <aside className="ff-sidebar" aria-label={t('候選規則與教學說明')}>
      <section className="ff-panel" aria-labelledby="candidate-title">
        <h2 id="candidate-title">{t('候選規則')}</h2>
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
          {t('猜想與一般實驗不會改變候選。只有正確的教學示例，才能成為排除規則的證據。')}
        </p>
      </section>
      <section className="ff-panel" aria-labelledby="teacher-tip-title">
        <h2 id="teacher-tip-title">{t('老師的小提醒')}</h2>
        <p className="ff-sidebar-note">
          {t(
            '答案碰巧相同，不代表推理正確。試試不同分母，或是零與負數，看看哪條規則還說得通。',
          )}
        </p>
        {session.hypothesis && (
          <p className="ff-sidebar-note">
            {t('你的初始猜想：')}
            {ruleCopy[session.hypothesis].title}
            {t('。讓實驗來檢查它。')}
          </p>
        )}
      </section>
    </aside>
  );
}

export function FractionFoxGame() {
  const { t, locale } = useI18n();
  const ruleCopy = useRuleCopy();

  const [session, setSession] = useLessonProgress('fractionfox', createSession);
  const robotName = 'FractionFox';
  const feedbackParameters = {
    prediction: session.hypothesis
      ? formatFraction(evaluateRule(session.hypothesis, observationInput).answer)
      : '?',
    observed: formatFraction(
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
    progressStore.resetLesson('fractionfox');
    setFeedback(null);
    setHypothesis(null);
    setExperimentDraft(initialDraft());
    setTeachingDraft(initialDraft());
    setTeachingAnswer(emptyAnswer());
    setVerificationAnswer(emptyAnswer());
  }

  function startTeaching() {
    const result = beginTeaching(session);
    apply(result);
    if (result.state.stage === 'teach' && latestExperiment) {
      setTeachingDraft({
        left: {
          numerator: latestExperiment.input.left.numerator.toString(),
          denominator: latestExperiment.input.left.denominator.toString(),
        },
        right: {
          numerator: latestExperiment.input.right.numerator.toString(),
          denominator: latestExperiment.input.right.denominator.toString(),
        },
      });
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
      setVerificationAnswer(emptyAnswer());
    }
  }

  return (
    <div className="ff-game">
      <a className="skip-link" href="#fractionfox-content">
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
            type="button"
            className="ff-button ff-button-secondary"
            onClick={restart}
          >
            {t('重新開始')}
          </button>
        </div>
      </header>
      <main id="fractionfox-content" className="page-width" tabIndex={-1}>
        <div className="ff-lesson-intro">
          <RobotPortrait kind="fox" className="ff-intro-portrait" />
          <div>
            <p className="ff-kicker">{t('LESSON 01 / 分數加法')}</p>
            <h1>{t('FractionFox 的分數教室')}</h1>
            <p>{t('牠會算，卻還沒想對。用你的實驗，教會牠同樣大小的「一份」。')}</p>
          </div>
        </div>
        <LessonProgress stage={session.stage} />
        <div className="ff-workspace">
          <section className="ff-panel" aria-labelledby="stage-title">
            <h2
              ref={stageHeading}
              tabIndex={-1}
              id="stage-title"
              className="ff-stage-heading"
            >
              {session.stage === 'observe' && t('01 / 先聽聽牠怎麼想')}
              {session.stage === 'hypothesize' && t('02 / 提出你的猜想')}
              {session.stage === 'experiment' && t('03 / 用一個實驗檢查猜想')}
              {session.stage === 'teach' && t('04 / 用正確示例教牠')}
              {session.stage === 'verify' && t('05 / 換道新題，真的學會了嗎？')}
              {session.stage === 'complete' && t('FractionFox 畢業了！')}
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
                  {t(
                    '這是狐狸的第一份作業。答案是從牠的規則算出來的。先看計算，再讀牠的推理。',
                  )}
                </p>
                <div className="ff-observation">
                  <AdditionEquation
                    input={observationInput}
                    answer={evaluateRule(session.currentRuleId, observationInput).answer}
                    label={t('狐狸的作業')}
                  />
                  <div className="ff-area-pair">
                    <FractionArea value={observationInput.left} label={t('第一個分數')} />
                    <FractionArea
                      value={observationInput.right}
                      label={t('第二個分數')}
                    />
                  </div>
                </div>
                <ReasoningDialogue
                  evaluation={evaluateRule(session.currentRuleId, observationInput)}
                />
                <p className="ff-prompt">
                  {t('分母代表每一份的大小。兩種大小不同的「一份」，能直接相加嗎？')}
                </p>
                <button
                  type="button"
                  className="ff-button"
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
                    '從剛才的答案與推理，判斷牠可能用了哪種錯誤規則。猜想可以不對；接下來用實驗檢查。',
                  )}
                </p>
                <AdditionEquation
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
                    <legend className="sr-only">{t('選擇可能的錯誤規則')}</legend>
                    <div className="ff-choice-list">
                      {(['add-both', 'keep-first'] as const).map((id) => (
                        <label className="ff-choice" key={id}>
                          <input
                            type="radio"
                            name="hypothesis"
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
                    '設計一組分數，看牠會算出什麼。實驗會顯示正確答案，卻不會替你排除候選規則。',
                  )}
                </p>
                <form
                  onSubmit={submitExperiment}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <AdditionFields
                    value={experimentDraft}
                    onChange={setExperimentDraft}
                    errorId={errorId}
                  />
                  <p className="ff-form-hint">
                    {t(
                      '分子是 −1000 到 1000 的整數；分母是 1 到 1000 的正整數。保留你輸入的分數寫法，不先約分。',
                    )}
                  </p>
                  <button className="ff-button" type="submit">
                    {t('測試狐狸的回答')}
                  </button>
                </form>
                {latestExperiment && (
                  <>
                    <div className="ff-comparison">
                      <div
                        className="ff-result-box"
                        data-wrong={
                          !areRationalsEqual(
                            latestExperiment.robotEvaluation.answer,
                            latestExperiment.correctAnswer,
                          )
                        }
                      >
                        <h3>{t('最近一次實驗 · 狐狸答案')}</h3>
                        <AdditionEquation
                          input={latestExperiment.input}
                          answer={latestExperiment.robotEvaluation.answer}
                        />
                      </div>
                      <div className="ff-result-box">
                        <h3>{t('數學正確答案')}</h3>
                        <AdditionEquation
                          input={latestExperiment.input}
                          answer={latestExperiment.correctAnswer}
                        />
                      </div>
                    </div>
                    <p
                      className="ff-result-status"
                      data-wrong={
                        !areRationalsEqual(
                          latestExperiment.robotEvaluation.answer,
                          latestExperiment.correctAnswer,
                        )
                      }
                    >
                      {areRationalsEqual(
                        latestExperiment.robotEvaluation.answer,
                        latestExperiment.correctAnswer,
                      )
                        ? t('答案碰巧相同。這次還不能證明牠的規則正確。')
                        : t('結果不同！這個實驗揭露了牠的迷思。')}
                    </p>
                    <ReasoningDialogue evaluation={latestExperiment.robotEvaluation} />
                  </>
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
                    '你現在是老師。提交兩個分數與你認為正確的答案，系統會先核對，再用證據檢查每條候選規則。',
                  )}
                </p>
                <form
                  onSubmit={submitTeaching}
                  onChange={() => feedback?.kind === 'error' && setFeedback(null)}
                >
                  <AdditionFields
                    value={teachingDraft}
                    onChange={setTeachingDraft}
                    errorId={errorId}
                  />
                  <div className="ff-answer-field">
                    <FractionFields
                      label={t('教學答案')}
                      value={teachingAnswer}
                      onChange={setTeachingAnswer}
                      errorId={(field) => errorId(['proposedAnswer', field])}
                    />
                  </div>
                  <p className="ff-form-hint">
                    {t(
                      '等價分數都接受。例如 2/4 與 1/2 相同。零分母、小數或錯誤答案都不能成為證據。',
                    )}
                  </p>
                  <button className="ff-button" type="submit">
                    {t('提交正確示例')}
                  </button>
                </form>
                {latestEvidence && (
                  <>
                    <div className="ff-evidence-latest">
                      <p>{t('最近一次有效示例')}</p>
                      <AdditionEquation
                        input={latestEvidence.input}
                        answer={latestEvidence.proposedAnswer}
                      />
                      <ul className="ff-evidence-comparisons">
                        {latestEvidence.comparisons.map((comparison) => (
                          <li key={comparison.ruleId}>
                            <span>{ruleCopy[comparison.ruleId].title}</span>
                            <strong>
                              {formatFraction(comparison.evaluation.answer)}
                            </strong>
                            <span data-compatible={comparison.compatible}>
                              {comparison.compatible
                                ? t('符合 · 保留')
                                : t('矛盾 · 排除')}
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
                            ? t('示例已記錄；只剩正確規則，可以開始最終驗證。')
                            : t(
                                '沒有候選被排除：這些規則在此題恰好算出相同答案。請設計不同的例子。',
                              )}
                      </p>
                    </div>
                    <div className="ff-verification-result">
                      <h3>{t('狐狸現在怎麼算？')}</h3>
                      <AdditionEquation
                        input={latestEvidence.input}
                        answer={
                          evaluateRule(session.currentRuleId, latestEvidence.input).answer
                        }
                        label={t('目前規則的回答')}
                      />
                      <ReasoningDialogue
                        evaluation={evaluateRule(
                          session.currentRuleId,
                          latestEvidence.input,
                        )}
                      />
                    </div>
                  </>
                )}
                {session.evidence.length > 0 && (
                  <details className="ff-history">
                    <summary>
                      {t('查看教學記錄（')}
                      {session.evidence.length}
                      {t(' 個有效示例）')}
                    </summary>
                    <ol>
                      {session.evidence.map((record, index) => (
                        <li key={index}>
                          <p>
                            {formatFraction(record.input.left)} +{' '}
                            {formatFraction(record.input.right)} ={' '}
                            {formatFraction(record.proposedAnswer)}
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
                    ? t('只剩通分規則了。下一步用三道未見題目，讓你和狐狸一起驗證理解。')
                    : t(
                        '只剩正確規則時才能驗證。試試相同分母，再試不同分母：它們能區分不同的迷思。',
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
                    '這三道題目沒有在觀察、實驗或有效教學示例中出現。你先作答；狐狸也必須使用最後留下的規則算對。',
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
                      <div
                        className="ff-verification-equation"
                        role="img"
                        aria-label={t('{v0} 加 {v1} 等於多少？', {
                          v0: formatFraction(question.input.left),
                          v1: formatFraction(question.input.right),
                        })}
                      >
                        <FractionValue value={question.input.left} />
                        <span aria-hidden="true">+</span>
                        <FractionValue value={question.input.right} />
                        <span aria-hidden="true">= ?</span>
                      </div>
                    </div>
                    <div className="ff-answer-field">
                      <FractionFields
                        label={t('驗證答案')}
                        value={verificationAnswer}
                        onChange={setVerificationAnswer}
                        errorId={(field) => errorId(['proposedAnswer', field])}
                      />
                    </div>
                    <p className="ff-form-hint">
                      {t('請寫出精確分數答案。答錯可以修正，已完成的題目不會重複計分。')}
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
                        <h3>{t('上一題 · 你和狐狸都答對了')}</h3>
                        <AdditionEquation
                          input={previous.input}
                          answer={
                            evaluateRule(session.currentRuleId, previous.input).answer
                          }
                        />
                        <ReasoningDialogue
                          evaluation={evaluateRule(session.currentRuleId, previous.input)}
                        />
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
                    '你用正確示例排除了兩種迷思；狐狸用通分規則算對了三道新題，你也完成了全部驗證。這次，是你教會了牠。',
                  )}
                </p>
                <div className="ff-completion-stats">
                  <div>
                    <strong>2</strong>
                    <span>{t('錯誤規則已排除')}</span>
                  </div>
                  <div>
                    <strong>3 / 3</strong>
                    <span>{t('你與狐狸答對')}</span>
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
                        {t(' · 學生與狐狸驗證通過')}
                      </p>
                      <AdditionEquation
                        input={item.input}
                        answer={evaluateRule(session.currentRuleId, item.input).answer}
                      />
                    </div>
                  ))}
                </div>
                <div className="ff-actions">
                  <button type="button" className="ff-button" onClick={restart}>
                    {t('再教一次')}
                  </button>
                  <a href="#" className="ff-button ff-button-secondary">
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

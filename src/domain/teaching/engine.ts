import type {
  ExperimentSubmission,
  ReasoningRule,
  RuleEvaluation,
  ValidationIssue,
  ValidationResult,
} from '../contracts';

export type Stage =
  'observe' | 'hypothesize' | 'experiment' | 'teach' | 'verify' | 'complete';
export interface ExperimentRecord<Input, Answer, Id extends string> {
  readonly id: string;
  readonly input: Input;
  readonly ruleId: Id;
  readonly robotEvaluation: RuleEvaluation<Answer>;
  readonly correctAnswer: Answer;
  readonly robotWasCorrect: boolean;
}
export interface RuleComparison<Answer, Id extends string> {
  readonly ruleId: Id;
  readonly evaluation: RuleEvaluation<Answer>;
  readonly compatible: boolean;
}
export interface TeachingRecord<Input, Answer, Id extends string> {
  readonly id: string;
  readonly input: Input;
  readonly proposedAnswer: Answer;
  readonly eliminatedRuleIds: readonly Id[];
  readonly remainingRuleIds: readonly Id[];
  readonly comparisons: readonly RuleComparison<Answer, Id>[];
}
export interface VerificationQuestion<Input, Answer> {
  readonly id: string;
  readonly input: Input;
  readonly robotEvaluation: RuleEvaluation<Answer>;
  readonly correctAnswer: Answer;
}
export interface VerificationAnswer<Answer> {
  readonly questionId: string;
  readonly answer: Answer;
  readonly robotWasCorrect: boolean;
}
export interface SessionState<Input, Answer, Id extends string> {
  readonly stage: Stage;
  readonly candidateRuleIds: readonly Id[];
  readonly currentRuleId: Id;
  readonly hypothesis: Id | null;
  readonly experiments: readonly ExperimentRecord<Input, Answer, Id>[];
  readonly evidence: readonly TeachingRecord<Input, Answer, Id>[];
  readonly verification: readonly VerificationQuestion<Input, Answer>[];
  readonly verificationAnswers: readonly VerificationAnswer<Answer>[];
}
export interface Feedback {
  readonly kind: 'success' | 'error' | 'info';
  readonly code: string;
  readonly message: string;
  readonly issues?: readonly ValidationIssue[];
}
export interface SessionResult<Input, Answer, Id extends string> {
  readonly state: SessionState<Input, Answer, Id>;
  readonly feedback: Feedback;
}

/** Mathematics, input constraints, and question identity remain domain-owned. */
export interface TeachingEngineConfig<Input, Answer, Id extends string> {
  readonly name: string;
  readonly rules: Readonly<Record<Id, ReasoningRule<Input, Answer>>>;
  readonly correctId: Id;
  readonly orderedRuleIds: readonly Id[];
  readonly observationInput: Input;
  readonly parseInput: (candidate: unknown) => ValidationResult<Input>;
  readonly parseAnswer: (candidate: unknown) => ValidationResult<Answer>;
  readonly validateSubmission: (
    candidate: unknown,
  ) => ValidationResult<ExperimentSubmission<Input, Answer>>;
  readonly answersEqual: (left: Answer, right: Answer) => boolean;
  readonly sameInput: (left: Input, right: Input) => boolean;
  readonly verificationCandidates: () => Iterable<Input>;
  readonly formatAnswer: (answer: Answer) => string;
  readonly validationMessages?: Readonly<Record<string, string>>;
  readonly messages?: {
    readonly incorrectExample?: string;
    readonly incorrectVerification?: string;
    readonly lessonComplete?: string;
  };
}

export interface TeachingEngine<Input, Answer, Id extends string> {
  readonly createSession: () => SessionState<Input, Answer, Id>;
  readonly resetSession: () => SessionState<Input, Answer, Id>;
  readonly isReadyForVerification: (state: SessionState<Input, Answer, Id>) => boolean;
  readonly beginHypothesis: (
    state: SessionState<Input, Answer, Id>,
  ) => SessionResult<Input, Answer, Id>;
  readonly chooseHypothesis: (
    state: SessionState<Input, Answer, Id>,
    id: Id,
  ) => SessionResult<Input, Answer, Id>;
  readonly runExperiment: (
    state: SessionState<Input, Answer, Id>,
    draft: unknown,
  ) => SessionResult<Input, Answer, Id>;
  readonly beginTeaching: (
    state: SessionState<Input, Answer, Id>,
  ) => SessionResult<Input, Answer, Id>;
  readonly teachExample: (
    state: SessionState<Input, Answer, Id>,
    submission: unknown,
  ) => SessionResult<Input, Answer, Id>;
  readonly beginVerification: (
    state: SessionState<Input, Answer, Id>,
  ) => SessionResult<Input, Answer, Id>;
  readonly answerVerification: (
    state: SessionState<Input, Answer, Id>,
    questionId: string,
    answer: unknown,
  ) => SessionResult<Input, Answer, Id>;
}

/** A small pure state machine shared by concrete lessons, with no mutable session store. */
export function createTeachingEngine<Input, Answer, Id extends string>(
  config: TeachingEngineConfig<Input, Answer, Id>,
): TeachingEngine<Input, Answer, Id> {
  type State = SessionState<Input, Answer, Id>;
  type Result = SessionResult<Input, Answer, Id>;
  if (
    config.orderedRuleIds.length < 2 ||
    new Set(config.orderedRuleIds).size !== config.orderedRuleIds.length ||
    config.orderedRuleIds.at(-1) !== config.correctId ||
    config.rules[config.correctId]?.kind !== 'correct' ||
    config.orderedRuleIds.length !== Object.keys(config.rules).length ||
    config.orderedRuleIds.some(
      (id) =>
        config.rules[id]?.id !== id ||
        (id !== config.correctId && config.rules[id]?.kind !== 'misconception'),
    )
  ) {
    throw new Error(
      'Teaching rules must be unique, complete, and end with the single correct rule.',
    );
  }
  const allRuleIds = [
    config.correctId,
    ...config.orderedRuleIds.filter((id) => id !== config.correctId),
  ];
  const firstRule = config.orderedRuleIds[0];
  if (firstRule === undefined)
    throw new Error('A teaching lesson needs an initial misconception.');
  const initialRule: Id = firstRule;
  function evaluateRule(id: Id, input: Input): RuleEvaluation<Answer> {
    return config.rules[id].evaluate(input);
  }
  function generateVerification(
    state: State,
  ): readonly VerificationQuestion<Input, Answer>[] {
    const seen = [
      config.observationInput,
      ...state.experiments.map((item) => item.input),
      ...state.evidence.map((item) => item.input),
    ];
    const questions: VerificationQuestion<Input, Answer>[] = [];
    for (const input of config.verificationCandidates()) {
      if (seen.some((previous) => config.sameInput(previous, input))) continue;
      const robotEvaluation = evaluateRule(state.currentRuleId, input);
      const correctAnswer = evaluateRule(config.correctId, input).answer;
      questions.push({
        id: `verify-${questions.length + 1}`,
        input,
        robotEvaluation,
        correctAnswer,
      });
      seen.push(input);
      if (questions.length === 3) return questions;
    }
    return questions;
  }
  function createSession(): State {
    return {
      stage: 'observe',
      candidateRuleIds: [...allRuleIds],
      currentRuleId: initialRule,
      hypothesis: null,
      experiments: [],
      evidence: [],
      verification: [],
      verificationAnswers: [],
    };
  }

  function resetSession(): State {
    return createSession();
  }

  function result(
    state: State,
    kind: Feedback['kind'],
    code: string,
    message: string,
  ): Result {
    return { state, feedback: { kind, code, message } };
  }

  function invalidInput(state: State, issues: readonly ValidationIssue[]): Result {
    const messages = [
      ...new Set(
        issues.map(
          (item) => config.validationMessages?.[item.messageKey] ?? item.messageKey,
        ),
      ),
    ];
    return {
      state,
      feedback: {
        kind: 'error',
        code: 'invalid-input',
        message: messages.join(' '),
        issues,
      },
    };
  }

  function currentRule(candidates: readonly Id[]): Id | undefined {
    return config.orderedRuleIds.find((id) => candidates.includes(id));
  }

  function isConsistent(state: State): boolean {
    return (
      state.candidateRuleIds.length > 0 &&
      state.candidateRuleIds.includes(config.correctId) &&
      new Set(state.candidateRuleIds).size === state.candidateRuleIds.length &&
      state.candidateRuleIds.every((id) => allRuleIds.includes(id)) &&
      currentRule(state.candidateRuleIds) === state.currentRuleId
    );
  }

  function guard(state: State, stage: Stage): Result | undefined {
    if (!isConsistent(state)) {
      return result(
        state,
        'error',
        'inconsistent-state',
        '候選規則狀態不一致。請重新開始課程，不能把這個狀態視為學習完成。',
      );
    }
    if (state.stage !== stage) {
      return result(state, 'error', 'invalid-stage', '請依序完成目前的教學步驟。');
    }
    return undefined;
  }

  function beginHypothesis(state: State): Result {
    const rejected = guard(state, 'observe');
    return (
      rejected ??
      result(
        { ...state, stage: 'hypothesize' },
        'info',
        'ready-hypothesis',
        `先猜猜 ${config.name} 使用了哪條推理規則，再用實驗檢查。`,
      )
    );
  }

  function chooseHypothesis(state: State, id: Id): Result {
    const rejected = guard(state, 'hypothesize');
    if (rejected) return rejected;
    if (!allRuleIds.includes(id))
      return result(state, 'error', 'invalid-hypothesis', '請選擇一條已知的候選規則。');
    const prediction = evaluateRule(id, config.observationInput).answer;
    const observed = evaluateRule(state.currentRuleId, config.observationInput).answer;
    const matches = config.answersEqual(prediction, observed);
    return result(
      { ...state, stage: 'experiment', hypothesis: id },
      'info',
      matches ? 'hypothesis-matches' : 'hypothesis-differs',
      `你的假設預測 ${config.formatAnswer(prediction)}，${matches ? '符合' : '不同於'}剛才觀察到的 ${config.formatAnswer(observed)}。猜測不會淘汰規則，接著設計實驗。`,
    );
  }

  function runExperiment(state: State, draft: unknown): Result {
    const rejected = guard(state, 'experiment');
    if (rejected) return rejected;
    const parsed = config.parseInput(draft);
    if (!parsed.ok) return invalidInput(state, parsed.issues);
    const robotEvaluation = evaluateRule(state.currentRuleId, parsed.value);
    const correctAnswer = evaluateRule(config.correctId, parsed.value).answer;
    const record: ExperimentRecord<Input, Answer, Id> = {
      id: `experiment-${state.experiments.length + 1}`,
      input: parsed.value,
      ruleId: state.currentRuleId,
      robotEvaluation,
      correctAnswer,
      robotWasCorrect: config.answersEqual(robotEvaluation.answer, correctAnswer),
    };
    return result(
      { ...state, experiments: [...state.experiments, record] },
      'info',
      'experiment-recorded',
      record.robotWasCorrect
        ? '這次機器人的答案碰巧正確。單次答對不代表所有規則都正確，試試更能區分規則的題目。'
        : '這個實驗顯示機器人的答案與正確答案不同。觀察推理，再用正確示例教導它。',
    );
  }

  function beginTeaching(state: State): Result {
    const rejected = guard(state, 'experiment');
    if (rejected) return rejected;
    if (state.experiments.length === 0 || state.hypothesis === null) {
      return result(state, 'error', 'experiment-required', '請先完成至少一個有效實驗。');
    }
    return result(
      { ...state, stage: 'teach' },
      'info',
      'ready-teaching',
      '提交你確認正確的答案，讓證據逐步排除錯誤規則。',
    );
  }

  function teachExample(state: State, submission: unknown): Result {
    const rejected = guard(state, 'teach');
    if (rejected) return rejected;
    const parsed = config.validateSubmission(submission);
    if (!parsed.ok) return invalidInput(state, parsed.issues);
    const { input, proposedAnswer } = parsed.value;
    const correctAnswer = evaluateRule(config.correctId, input).answer;
    if (!config.answersEqual(proposedAnswer, correctAnswer)) {
      return result(
        state,
        'error',
        'incorrect-example',
        config.messages?.incorrectExample ??
          '這個示例的答案還不正確，沒有改變候選規則。請檢查推理後再試。',
      );
    }
    const comparisons: readonly RuleComparison<Answer, Id>[] = state.candidateRuleIds.map(
      (ruleId) => {
        const evaluation = evaluateRule(ruleId, input);
        return {
          ruleId,
          evaluation,
          compatible: config.answersEqual(evaluation.answer, proposedAnswer),
        };
      },
    );
    const remainingRuleIds = comparisons
      .filter((item) => item.compatible)
      .map((item) => item.ruleId);
    const eliminatedRuleIds = comparisons
      .filter((item) => !item.compatible)
      .map((item) => item.ruleId);
    const nextRule = currentRule(remainingRuleIds);
    if (!nextRule || !remainingRuleIds.includes(config.correctId)) {
      return result(
        state,
        'error',
        'inconsistent-evidence',
        '有效示例意外排除了正確規則。請重新開始，這不能視為完成。',
      );
    }
    const record: TeachingRecord<Input, Answer, Id> = {
      id: `example-${state.evidence.length + 1}`,
      input,
      proposedAnswer,
      eliminatedRuleIds,
      remainingRuleIds,
      comparisons,
    };
    const next = {
      ...state,
      candidateRuleIds: remainingRuleIds,
      currentRuleId: nextRule,
      evidence: [...state.evidence, record],
    };
    if (state.candidateRuleIds.length === 1) {
      return result(
        next,
        'success',
        'ready-verification',
        '正確示例已記錄，仍然只剩正確規則。接著用三道未教過的新題目檢查理解。',
      );
    }
    if (eliminatedRuleIds.length === 0) {
      return result(
        next,
        'info',
        'non-discriminating',
        '答案正確，但存活規則在這題得到了相同答案。示例已記錄，請換一個更能區分規則的反例。',
      );
    }
    return result(
      next,
      'success',
      remainingRuleIds.length === 1 ? 'ready-verification' : 'rules-eliminated',
      remainingRuleIds.length === 1
        ? '目前只剩正確規則。接著用三道未教過的新題目檢查你和機器人的理解。'
        : `已根據這個正確示例排除 ${eliminatedRuleIds.length} 條錯誤規則。還有候選規則，需要更多證據。`,
    );
  }

  function isReadyForVerification(state: State): boolean {
    return (
      state.candidateRuleIds.length === 1 &&
      state.currentRuleId === config.correctId &&
      state.evidence.length > 0 &&
      state.experiments.length > 0 &&
      state.hypothesis !== null
    );
  }

  function beginVerification(state: State): Result {
    const rejected = guard(state, 'teach');
    if (rejected) return rejected;
    if (!isReadyForVerification(state)) {
      return result(
        state,
        'error',
        'teaching-required',
        '請先用正確示例排除所有已知迷思規則。',
      );
    }
    const verification = generateVerification(state);
    if (verification.length !== 3)
      return result(
        state,
        'error',
        'verification-unavailable',
        '目前無法產生三道未見題，請重新開始課程。',
      );
    if (
      !verification.every((question) =>
        config.answersEqual(question.robotEvaluation.answer, question.correctAnswer),
      )
    ) {
      return result(
        state,
        'error',
        'robot-verification-failed',
        '機器人在新題目的答案未通過檢查，不能宣稱完成。',
      );
    }
    return result(
      { ...state, stage: 'verify', verification, verificationAnswers: [] },
      'info',
      'verification-started',
      '依序回答三道未見題。答錯可以修改，不會直接完成課程。',
    );
  }

  function answerVerification(state: State, questionId: string, answer: unknown): Result {
    const rejected = guard(state, 'verify');
    if (rejected) return rejected;
    if (!isReadyForVerification(state)) {
      return result(
        state,
        'error',
        'teaching-required',
        '這個狀態缺少完整的教學證據，不能跳過前面的步驟完成驗證。',
      );
    }
    const question = state.verification[state.verificationAnswers.length];
    if (!question || question.id !== questionId || state.verification.length !== 3) {
      return result(state, 'error', 'question-order', '請先回答目前顯示的未見題。');
    }
    const parsed = config.parseAnswer(answer);
    if (!parsed.ok) return invalidInput(state, parsed.issues);
    const correctAnswer = evaluateRule(config.correctId, question.input).answer;
    if (!config.answersEqual(parsed.value, correctAnswer)) {
      return result(
        state,
        'error',
        'incorrect-verification',
        config.messages?.incorrectVerification ??
          '這題答案還不正確。檢查推理後，可以修改再重試。',
      );
    }
    const robotAnswer = evaluateRule(state.currentRuleId, question.input).answer;
    const robotWasCorrect = config.answersEqual(robotAnswer, correctAnswer);
    if (
      !robotWasCorrect ||
      !config.answersEqual(question.robotEvaluation.answer, correctAnswer)
    ) {
      return result(
        state,
        'error',
        'robot-verification-failed',
        '機器人的推理未通過新題檢查，不能宣稱完成。',
      );
    }
    const verificationAnswers = [
      ...state.verificationAnswers,
      { questionId, answer: parsed.value, robotWasCorrect },
    ];
    const completed =
      isReadyForVerification(state) &&
      verificationAnswers.length === 3 &&
      state.verification.every((item, index) => {
        const accepted = verificationAnswers[index];
        const expected = evaluateRule(config.correctId, item.input).answer;
        return (
          accepted !== undefined &&
          accepted.questionId === item.id &&
          config.answersEqual(accepted.answer, expected) &&
          config.answersEqual(
            evaluateRule(state.currentRuleId, item.input).answer,
            expected,
          ) &&
          config.answersEqual(item.robotEvaluation.answer, expected)
        );
      });
    return result(
      { ...state, stage: completed ? 'complete' : 'verify', verificationAnswers },
      'success',
      completed ? 'lesson-complete' : 'verification-correct',
      completed
        ? (config.messages?.lessonComplete ??
            `你和 ${config.name} 都通過了三道未見題！在這組已知規則中，錯誤假設已被證據排除。`)
        : '答案正確，繼續下一道未見題。',
    );
  }

  return {
    createSession,
    resetSession,
    isReadyForVerification,
    beginHypothesis,
    chooseHypothesis,
    runExperiment,
    beginTeaching,
    teachExample,
    beginVerification,
    answerVerification,
  };
}

import * as fraction from '../domain/fractionFox/engine';
import * as discount from '../domain/discountPanda/engine';
import * as minus from '../domain/minusMole/engine';
import * as chance from '../domain/chanceCrow/engine';
import type { Rational } from '../domain/math/rational';
import type { SessionState, Stage, SessionResult } from '../domain/teaching/engine';
import type { LessonId, LessonStateMap } from './types';

export const schemaVersion = 1;
export const lessonVersions = {
  fractionfox: 1,
  discountpanda: 1,
  minusmole: 1,
  chancecrow: 1,
} as const satisfies Record<LessonId, number>;
export const maximumHistory = 100;
export const maximumProgressBytes = 128_000;

interface EvidenceDto {
  readonly input: unknown;
  readonly proposedAnswer: unknown;
}
/** Only accepted learner actions are saved. Derived evaluations are replayed. */
export interface ProgressDto {
  readonly schemaVersion: 1;
  readonly lessonVersion: number;
  readonly lessonId: LessonId;
  readonly stage: Stage;
  readonly hypothesis: string | null;
  readonly experiments: readonly unknown[];
  readonly evidence: readonly EvidenceDto[];
  readonly verificationAnswers: readonly unknown[];
  readonly additionalSeenInputs?: readonly unknown[];
}
export type DecodeResult<State> =
  | { readonly ok: true; readonly state: State }
  | { readonly ok: false; readonly reason: 'corrupt' | 'unsupported-version' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 32;
}
function rationalShape(value: unknown): boolean {
  return (
    hasKeys(value, ['numerator', 'denominator']) &&
    isText(value.numerator) &&
    isText(value.denominator)
  );
}
function rawRational(value: Rational): fraction.RawFraction {
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
  };
}
function rawFractionInput(value: fraction.AdditionInput): fraction.DraftAddition {
  // Keep unreduced operands: FractionFox misconceptions depend on their representation.
  return { left: rawRational(value.left), right: rawRational(value.right) };
}
function rawDiscountInput(value: discount.DiscountInput): discount.RawDiscountInput {
  return {
    price: discount.formatMoney(value.priceCents),
    firstDiscount: discount.formatPercent(value.firstDiscount),
    secondDiscount: discount.formatPercent(value.secondDiscount),
  };
}
function rawMinusInput(value: minus.SubtractionInput): minus.RawSubtractionInput {
  return { a: value.a.toString(), b: value.b.toString() };
}
function rawChanceInput(value: chance.ChanceInput): chance.RawChanceInput {
  return {
    red: value.red.toString(),
    blue: value.blue.toString(),
    first: value.first,
    second: value.second,
  };
}
function textFields(value: unknown, keys: readonly string[]): boolean {
  return hasKeys(value, keys) && keys.every((key) => isText(value[key]));
}
const stages: readonly Stage[] = [
  'observe',
  'hypothesize',
  'experiment',
  'teach',
  'verify',
  'complete',
];

interface Codec<State> {
  readonly createSession: () => State;
  readonly encode: (state: State) => string;
  readonly decode: (text: string) => DecodeResult<State>;
  readonly isComplete: (state: State) => boolean;
}
interface ReplayConfig<
  Input,
  Answer,
  Id extends string,
  State extends SessionState<Input, Answer, Id>,
> {
  readonly lessonId: LessonId;
  readonly createSession: () => State;
  readonly beginHypothesis: (state: State) => {
    readonly state: State;
    readonly feedback: SessionResult<Input, Answer, Id>['feedback'];
  };
  readonly chooseHypothesis: (
    state: State,
    id: Id,
  ) => {
    readonly state: State;
    readonly feedback: SessionResult<Input, Answer, Id>['feedback'];
  };
  readonly runExperiment: (
    state: State,
    input: unknown,
  ) => {
    readonly state: State;
    readonly feedback: SessionResult<Input, Answer, Id>['feedback'];
  };
  readonly beginTeaching: (state: State) => {
    readonly state: State;
    readonly feedback: SessionResult<Input, Answer, Id>['feedback'];
  };
  readonly teachExample: (
    state: State,
    submission: unknown,
  ) => {
    readonly state: State;
    readonly feedback: SessionResult<Input, Answer, Id>['feedback'];
  };
  readonly beginVerification: (state: State) => {
    readonly state: State;
    readonly feedback: SessionResult<Input, Answer, Id>['feedback'];
  };
  readonly answerVerification: (
    state: State,
    questionId: string,
    answer: unknown,
  ) => {
    readonly state: State;
    readonly feedback: SessionResult<Input, Answer, Id>['feedback'];
  };
  readonly ruleIds: readonly Id[];
  readonly rawInput: (input: Input) => unknown;
  readonly rawAnswer: (answer: Answer) => unknown;
  readonly inputShape: (input: unknown) => boolean;
  readonly answerShape: (answer: unknown) => boolean;
  readonly additional?: {
    readonly get: (state: State) => readonly Input[];
    readonly replay: (state: State, input: unknown) => State | null;
  };
}
function createCodec<
  Input,
  Answer,
  Id extends string,
  State extends SessionState<Input, Answer, Id>,
>(config: ReplayConfig<Input, Answer, Id, State>): Codec<State> {
  const lessonVersion = lessonVersions[config.lessonId];
  function encode(state: State): string {
    const dto: ProgressDto = {
      schemaVersion,
      lessonVersion,
      lessonId: config.lessonId,
      stage: state.stage,
      hypothesis: state.hypothesis,
      experiments: state.experiments.map((record) => config.rawInput(record.input)),
      evidence: state.evidence.map((record) => ({
        input: config.rawInput(record.input),
        proposedAnswer: config.rawAnswer(record.proposedAnswer),
      })),
      verificationAnswers: state.verificationAnswers.map((record) =>
        config.rawAnswer(record.answer),
      ),
      ...(config.additional
        ? { additionalSeenInputs: config.additional.get(state).map(config.rawInput) }
        : {}),
    };
    return JSON.stringify(dto);
  }
  function decode(text: string): DecodeResult<State> {
    const corrupt: DecodeResult<State> = { ok: false, reason: 'corrupt' };
    if (text.length > maximumProgressBytes) return corrupt;
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return corrupt;
    }
    if (!isRecord(value) || value.lessonId !== config.lessonId) return corrupt;
    if (
      typeof value.schemaVersion !== 'number' ||
      typeof value.lessonVersion !== 'number' ||
      !Number.isSafeInteger(value.schemaVersion) ||
      !Number.isSafeInteger(value.lessonVersion) ||
      value.schemaVersion <= 0 ||
      value.lessonVersion <= 0
    )
      return corrupt;
    // A future incompatible version is retained in storage until explicit reset.
    if (value.schemaVersion !== schemaVersion || value.lessonVersion !== lessonVersion)
      return { ok: false, reason: 'unsupported-version' };
    const keys = [
      'schemaVersion',
      'lessonVersion',
      'lessonId',
      'stage',
      'hypothesis',
      'experiments',
      'evidence',
      'verificationAnswers',
    ];
    if (config.additional) keys.push('additionalSeenInputs');
    if (!hasKeys(value, keys)) return corrupt;
    const stage = stages.find((item) => item === value.stage);
    if (
      !stage ||
      !Array.isArray(value.experiments) ||
      !Array.isArray(value.evidence) ||
      !Array.isArray(value.verificationAnswers)
    )
      return corrupt;
    const additional: unknown[] =
      config.additional && Array.isArray(value.additionalSeenInputs)
        ? value.additionalSeenInputs
        : [];
    if (config.additional && !Array.isArray(value.additionalSeenInputs)) return corrupt;
    if (
      value.experiments.length > maximumHistory ||
      value.evidence.length > maximumHistory ||
      additional.length > maximumHistory ||
      value.verificationAnswers.length > 3 ||
      value.experiments.length + value.evidence.length + additional.length >
        maximumHistory * 2
    )
      return corrupt;
    let state = config.createSession();
    if (stage === 'observe')
      return value.hypothesis === null &&
        value.experiments.length === 0 &&
        value.evidence.length === 0 &&
        value.verificationAnswers.length === 0 &&
        additional.length === 0
        ? { ok: true, state }
        : corrupt;
    state = config.beginHypothesis(state).state;
    if (stage === 'hypothesize')
      return value.hypothesis === null &&
        value.experiments.length === 0 &&
        value.evidence.length === 0 &&
        value.verificationAnswers.length === 0 &&
        additional.length === 0
        ? { ok: true, state }
        : corrupt;
    const hypothesis = config.ruleIds.find((id) => id === value.hypothesis);
    if (!hypothesis) return corrupt;
    const chosen = config.chooseHypothesis(state, hypothesis);
    if (chosen.feedback.kind === 'error') return corrupt;
    state = chosen.state;
    for (const input of value.experiments) {
      if (!config.inputShape(input)) return corrupt;
      const result = config.runExperiment(state, input);
      if (result.feedback.kind === 'error') return corrupt;
      state = result.state;
    }
    if (stage === 'experiment')
      return value.evidence.length === 0 &&
        value.verificationAnswers.length === 0 &&
        additional.length === 0
        ? { ok: true, state }
        : corrupt;
    const teaching = config.beginTeaching(state);
    if (teaching.feedback.kind === 'error') return corrupt;
    state = teaching.state;
    for (const input of additional) {
      if (!config.inputShape(input) || !config.additional) return corrupt;
      const next = config.additional.replay(state, input);
      if (next === null) return corrupt;
      state = next;
    }
    for (const item of value.evidence) {
      if (
        !hasKeys(item, ['input', 'proposedAnswer']) ||
        !config.inputShape(item.input) ||
        !config.answerShape(item.proposedAnswer)
      )
        return corrupt;
      const result = config.teachExample(state, item);
      if (result.feedback.kind === 'error') return corrupt;
      state = result.state;
    }
    if (stage === 'teach')
      return value.verificationAnswers.length === 0 ? { ok: true, state } : corrupt;
    const verification = config.beginVerification(state);
    if (verification.feedback.kind === 'error') return corrupt;
    state = verification.state;
    for (const answer of value.verificationAnswers) {
      if (!config.answerShape(answer)) return corrupt;
      const question = state.verification[state.verificationAnswers.length];
      if (!question) return corrupt;
      const result = config.answerVerification(state, question.id, answer);
      if (result.feedback.kind === 'error') return corrupt;
      state = result.state;
    }
    return state.stage === stage ? { ok: true, state } : corrupt;
  }
  function isComplete(state: State): boolean {
    if (state.stage !== 'complete' || state.verificationAnswers.length !== 3)
      return false;
    // Reuse the shared engine's actual completion guard, including exact answers,
    // ordered questions and the student's and robot's verification. This also
    // works when a valid live history has grown beyond the persistence limit.
    try {
      let replay: State = { ...state, stage: 'verify', verificationAnswers: [] };
      for (const accepted of state.verificationAnswers) {
        const result = config.answerVerification(
          replay,
          accepted.questionId,
          config.rawAnswer(accepted.answer),
        );
        if (result.feedback.kind === 'error') return false;
        replay = result.state;
      }
      return replay.stage === 'complete';
    } catch {
      return false;
    }
  }
  return { createSession: config.createSession, encode, decode, isComplete };
}

export const lessonCodecs: { readonly [Id in LessonId]: Codec<LessonStateMap[Id]> } = {
  fractionfox: createCodec<
    fraction.AdditionInput,
    Rational,
    fraction.RuleId,
    fraction.SessionState
  >({
    ...fraction,
    lessonId: 'fractionfox',
    ruleIds: ['correct', 'add-both', 'keep-first'],
    rawInput: rawFractionInput,
    rawAnswer: rawRational,
    inputShape: (value) =>
      hasKeys(value, ['left', 'right']) &&
      rationalShape(value.left) &&
      rationalShape(value.right),
    answerShape: rationalShape,
  }),
  discountpanda: createCodec<
    discount.DiscountInput,
    bigint,
    discount.RuleId,
    discount.SessionState
  >({
    ...discount,
    lessonId: 'discountpanda',
    ruleIds: ['correct', 'add-discounts', 'only-second'],
    rawInput: rawDiscountInput,
    rawAnswer: discount.formatMoney,
    inputShape: (value) =>
      textFields(value, ['price', 'firstDiscount', 'secondDiscount']),
    answerShape: isText,
  }),
  minusmole: createCodec<
    minus.SubtractionInput,
    bigint,
    minus.RuleId,
    minus.SessionState
  >({
    ...minus,
    lessonId: 'minusmole',
    ruleIds: ['correct', 'subtract-absolute', 'absolute-result'],
    rawInput: rawMinusInput,
    rawAnswer: (value) => value.toString(),
    inputShape: (value) => textFields(value, ['a', 'b']),
    answerShape: isText,
  }),
  chancecrow: createCodec<
    chance.ChanceInput,
    Rational,
    chance.RuleId,
    chance.SessionState
  >({
    ...chance,
    lessonId: 'chancecrow',
    ruleIds: ['correct', 'independent', 'second-only'],
    rawInput: rawChanceInput,
    rawAnswer: rawRational,
    inputShape: (value) =>
      hasKeys(value, ['red', 'blue', 'first', 'second']) &&
      isText(value.red) &&
      isText(value.blue) &&
      chance.parseChanceInput(value).ok,
    answerShape: rationalShape,
    additional: {
      get: (state) => state.additionalSeenInputs ?? [],
      replay: (state, input) => {
        const count = state.additionalSeenInputs?.length ?? 0;
        // Preserve the valid seen input, without treating a rejected answer as evidence.
        const next = chance.teachExample(state, { input, proposedAnswer: null }).state;
        return (next.additionalSeenInputs?.length ?? 0) === count + 1 ? next : null;
      },
    },
  }),
};

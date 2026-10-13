import type {
  ExperimentSubmission,
  RobotDefinition,
  ValidationIssue,
  ValidationResult,
} from '../contracts';
import { createTeachingEngine } from '../teaching/engine';
import type {
  ExperimentRecord as SharedExperimentRecord,
  TeachingRecord as SharedTeachingRecord,
  RuleComparison as SharedRuleComparison,
  VerificationQuestion as SharedVerificationQuestion,
  VerificationAnswer as SharedVerificationAnswer,
  SessionState as SharedSessionState,
  SessionResult as SharedSessionResult,
  TeachingEngineConfig,
} from '../teaching/engine';
import { formatInteger, ruleDefinitions } from './rules';
import type { RuleId, SubtractionInput } from './rules';

export { evaluateRule, explainEvaluation, formatInteger, ruleDefinitions } from './rules';
export { createNumberLineModel } from './numberLine';
export type { NumberLineModel, NumberLineSegment } from './numberLine';
export type { RuleId, SubtractionInput } from './rules';
export type { Feedback, Stage } from '../teaching/engine';

export interface RawSubtractionInput {
  readonly a: string;
  readonly b: string;
}

export type SessionState = SharedSessionState<SubtractionInput, bigint, RuleId>;
export type SessionResult = SharedSessionResult<SubtractionInput, bigint, RuleId>;
export type ExperimentRecord = SharedExperimentRecord<SubtractionInput, bigint, RuleId>;
export type TeachingRecord = SharedTeachingRecord<SubtractionInput, bigint, RuleId>;
export type RuleComparison = SharedRuleComparison<bigint, RuleId>;
export type VerificationQuestion = SharedVerificationQuestion<SubtractionInput, bigint>;
export type VerificationAnswer = SharedVerificationAnswer<bigint>;

export const observationInput: SubtractionInput = { a: 5n, b: -3n };

const validationMessages: Readonly<Record<string, string>> = {
  'minus.validation.shape': '請完整填寫被減數與減數。',
  'minus.validation.integer': '請輸入整數；不能留空、使用小數或科學記號。',
  'minus.validation.operand-bound': '題目的兩個整數都必須介於 -20 與 20。',
  'minus.validation.answer-bound': '答案必須是介於 -40 與 40 的整數。',
};

function invalid<Value>(
  path: readonly string[],
  messageKey: string,
): ValidationResult<Value> {
  return {
    ok: false,
    issues: [{ code: messageKey.split('.').at(-1) ?? messageKey, path, messageKey }],
  };
}

function parseInteger(
  candidate: unknown,
  path: readonly string[],
  limit: bigint,
): ValidationResult<bigint> {
  if (typeof candidate !== 'string') return invalid(path, 'minus.validation.integer');
  const text = candidate.trim();
  if (text.length > 32 || !/^[+-]?\d+$/.test(text))
    return invalid(path, 'minus.validation.integer');
  const value = BigInt(text);
  if (value < -limit || value > limit)
    return invalid(
      path,
      limit === 20n ? 'minus.validation.operand-bound' : 'minus.validation.answer-bound',
    );
  return { ok: true, value };
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}

export function parseSubtractionInput(
  candidate: unknown,
): ValidationResult<SubtractionInput> {
  if (!isRecord(candidate)) return invalid(['input'], 'minus.validation.shape');
  const a = parseInteger(candidate.a, ['input', 'a'], 20n);
  const b = parseInteger(candidate.b, ['input', 'b'], 20n);
  if (!a.ok || !b.ok) {
    return {
      ok: false,
      issues: [...(!a.ok ? a.issues : []), ...(!b.ok ? b.issues : [])],
    };
  }
  return { ok: true, value: { a: a.value, b: b.value } };
}

export function parseIntegerAnswer(candidate: unknown): ValidationResult<bigint> {
  return parseInteger(candidate, ['proposedAnswer'], 40n);
}

function validateSubmission(
  candidate: unknown,
): ValidationResult<ExperimentSubmission<SubtractionInput, bigint>> {
  if (!isRecord(candidate)) return invalid([], 'minus.validation.shape');
  const input = parseSubtractionInput(candidate.input);
  const answer = parseIntegerAnswer(candidate.proposedAnswer);
  if (!input.ok || !answer.ok) {
    const issues: readonly ValidationIssue[] = [
      ...(!input.ok ? input.issues : []),
      ...(!answer.ok ? answer.issues : []),
    ];
    return { ok: false, issues };
  }
  return { ok: true, value: { input: input.value, proposedAnswer: answer.value } };
}

export const minusMoleDefinition: RobotDefinition<SubtractionInput, bigint> = {
  id: 'minus-mole',
  nameKey: 'robot.minus-mole.name',
  descriptionKey: 'robot.minus-mole.description',
  domain: {
    id: 'integer-subtraction',
    validateSubmission,
    answersEqual: (left, right) => left === right,
  },
  correctRule: ruleDefinitions.correct,
  misconceptionRules: [
    ruleDefinitions['subtract-absolute'],
    ruleDefinitions['absolute-result'],
  ],
};

/** Subtraction is ordered: swapping operands is a different experiment. */
export function sameSubtractionInput(
  left: SubtractionInput,
  right: SubtractionInput,
): boolean {
  return left.a === right.a && left.b === right.b;
}

export type SignScenario =
  'positive-minus-negative' | 'negative-minus-positive' | 'negative-minus-negative';

export function signScenario(input: SubtractionInput): SignScenario | undefined {
  if (input.a > 0n && input.b < 0n) return 'positive-minus-negative';
  if (input.a < 0n && input.b > 0n) return 'negative-minus-positive';
  if (input.a < 0n && input.b < 0n) return 'negative-minus-negative';
  return undefined;
}

const preferredQuestions: readonly SubtractionInput[] = [
  { a: 7n, b: -2n },
  { a: -4n, b: 3n },
  { a: -3n, b: -8n },
];

/** Preserve one unseen question per sign scenario even after the preferred inputs are taught. */
function* verificationCandidates(
  seen: readonly SubtractionInput[],
): Iterable<SubtractionInput> {
  for (const preferred of preferredQuestions) {
    const scenario = signScenario(preferred);
    if (!seen.some((previous) => sameSubtractionInput(previous, preferred))) {
      yield preferred;
      continue;
    }
    let selected = false;
    for (let a = -20n; a <= 20n && !selected; a += 1n) {
      for (let b = -20n; b <= 20n; b += 1n) {
        const input = { a, b };
        if (
          signScenario(input) !== scenario ||
          seen.some((previous) => sameSubtractionInput(previous, input))
        )
          continue;
        yield input;
        selected = true;
        break;
      }
    }
  }
}

const config: TeachingEngineConfig<SubtractionInput, bigint, RuleId> = {
  name: 'MinusMole',
  rules: ruleDefinitions,
  correctId: 'correct',
  orderedRuleIds: ['subtract-absolute', 'absolute-result', 'correct'],
  observationInput,
  parseInput: parseSubtractionInput,
  parseAnswer: parseIntegerAnswer,
  validateSubmission,
  answersEqual: minusMoleDefinition.domain.answersEqual,
  sameInput: sameSubtractionInput,
  verificationCandidates: () => verificationCandidates([observationInput]),
  formatAnswer: formatInteger,
  validationMessages,
  messages: {
    incorrectExample:
      '這個答案還不正確，候選規則沒有改變。先辨認減數的正負，再決定數線方向；負數結果要保留符號。',
    incorrectVerification:
      '答案還不正確。減去正數往左，減去負數往右；不要把負數結果改成正數。',
  },
};

const engine = createTeachingEngine(config);

export const {
  createSession,
  resetSession,
  isReadyForVerification,
  beginHypothesis,
  chooseHypothesis,
  runExperiment,
  beginTeaching,
  teachExample,
  answerVerification,
} = engine;

/** Selection is lesson-specific; all stage and completion guards stay in the shared engine. */
export function beginVerification(state: SessionState): SessionResult {
  const seen = [
    observationInput,
    ...state.experiments.map((item) => item.input),
    ...state.evidence.map((item) => item.input),
  ];
  return createTeachingEngine({
    ...config,
    verificationCandidates: () => verificationCandidates(seen),
  }).beginVerification(state);
}

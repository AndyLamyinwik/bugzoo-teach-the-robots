import type {
  ExperimentSubmission,
  RobotDefinition,
  ValidationIssue,
  ValidationResult,
} from '../contracts';
import { areRationalsEqual, createRational } from '../math/rational';
import type { Rational } from '../math/rational';
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
import { createProbabilityModel, isColor } from './probability';
import type { ChanceInput, Color } from './probability';
import { formatProbability, ruleDefinitions } from './rules';
import type { RuleId } from './rules';

export {
  evaluateRule,
  explainEvaluation,
  formatProbability,
  ruleDefinitions,
} from './rules';
export type { RuleId } from './rules';
export {
  createProbabilityModel,
  createBalls,
  enumerateSampleSpace,
  countColors,
  colorProbability,
  colorLabel,
} from './probability';
export type {
  ChanceInput,
  Color,
  ColorCounts,
  Ball,
  OrderedOutcome,
  ProbabilityModel,
} from './probability';
export {
  createDrawState,
  drawBall,
  resetDrawState,
  sampleTrial,
  simulateTrials,
  empiricalFrequency,
} from './sampling';
export type { DrawState, Trial, SimulationResult, Rng } from './sampling';
export type { Feedback, Stage } from '../teaching/engine';

export interface RawChanceInput {
  readonly red: string;
  readonly blue: string;
  readonly first: Color;
  readonly second: Color;
}
export interface RawProbability {
  readonly numerator: string;
  readonly denominator: string;
}
export type SessionState = SharedSessionState<ChanceInput, Rational, RuleId> & {
  /** Valid submitted inputs seen without becoming accepted teaching evidence. */
  readonly additionalSeenInputs?: readonly ChanceInput[];
};
export interface SessionResult {
  readonly state: SessionState;
  readonly feedback: SharedSessionResult<ChanceInput, Rational, RuleId>['feedback'];
}
export type ExperimentRecord = SharedExperimentRecord<ChanceInput, Rational, RuleId>;
export type TeachingRecord = SharedTeachingRecord<ChanceInput, Rational, RuleId>;
export type RuleComparison = SharedRuleComparison<Rational, RuleId>;
export type VerificationQuestion = SharedVerificationQuestion<ChanceInput, Rational>;
export type VerificationAnswer = SharedVerificationAnswer<Rational>;

export const observationInput: ChanceInput = {
  red: 3n,
  blue: 2n,
  first: 'red',
  second: 'blue',
};
const answerLimit = 1_000_000_000_000n;
const messages: Readonly<Record<string, string>> = {
  'chance.validation.shape': '請完整填寫球數、目標顏色與分數答案。',
  'chance.validation.integer':
    '球數與答案的分子、分母必須是整數字串，不能留空、使用小數或科學記號。',
  'chance.validation.ball-bound': '每種顏色的球數必須介於 0 與 10。',
  'chance.validation.total-bound': '總球數必須介於 2 與 12。',
  'chance.validation.color': '兩次目標顏色都必須選擇紅球或藍球。',
  'chance.validation.denominator': '機率分數的分母必須是正整數。',
  'chance.validation.answer-bound': '答案分子的絕對值與分母不能超過 1,000,000,000,000。',
  'chance.validation.probability':
    '機率必須介於 0 與 1；請使用非負分子，且分子不能大於分母。',
};

export function validationIssueMessage(issue: ValidationIssue): string {
  return messages[issue.messageKey] ?? issue.messageKey;
}
function invalid<Value>(
  path: readonly string[],
  messageKey: string,
): ValidationResult<Value> {
  return {
    ok: false,
    issues: [{ code: messageKey.split('.').at(-1) ?? messageKey, path, messageKey }],
  };
}
function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}
function parseInteger(
  candidate: unknown,
  path: readonly string[],
): ValidationResult<bigint> {
  if (typeof candidate !== 'string') return invalid(path, 'chance.validation.integer');
  const text = candidate.trim();
  if (text.length > 32 || !/^[+-]?\d+$/.test(text))
    return invalid(path, 'chance.validation.integer');
  return { ok: true, value: BigInt(text) };
}

export function parseChanceInput(candidate: unknown): ValidationResult<ChanceInput> {
  if (!isRecord(candidate)) return invalid(['input'], 'chance.validation.shape');
  const red = parseInteger(candidate.red, ['input', 'red']);
  const blue = parseInteger(candidate.blue, ['input', 'blue']);
  const issues: ValidationIssue[] = [
    ...(!red.ok ? red.issues : []),
    ...(!blue.ok ? blue.issues : []),
  ];
  if (red.ok && (red.value < 0n || red.value > 10n))
    issues.push({
      code: 'ball-bound',
      path: ['input', 'red'],
      messageKey: 'chance.validation.ball-bound',
    });
  if (blue.ok && (blue.value < 0n || blue.value > 10n))
    issues.push({
      code: 'ball-bound',
      path: ['input', 'blue'],
      messageKey: 'chance.validation.ball-bound',
    });
  if (!isColor(candidate.first) || !isColor(candidate.second))
    issues.push({
      code: 'color',
      path: ['input'],
      messageKey: 'chance.validation.color',
    });
  if (
    issues.length > 0 ||
    !red.ok ||
    !blue.ok ||
    !isColor(candidate.first) ||
    !isColor(candidate.second)
  )
    return { ok: false, issues };
  if (red.value + blue.value < 2n || red.value + blue.value > 12n)
    return invalid(['input'], 'chance.validation.total-bound');
  return {
    ok: true,
    value: {
      red: red.value,
      blue: blue.value,
      first: candidate.first,
      second: candidate.second,
    },
  };
}

export function parseProbabilityAnswer(candidate: unknown): ValidationResult<Rational> {
  if (!isRecord(candidate)) return invalid(['proposedAnswer'], 'chance.validation.shape');
  const numerator = parseInteger(candidate.numerator, ['proposedAnswer', 'numerator']);
  const denominator = parseInteger(candidate.denominator, [
    'proposedAnswer',
    'denominator',
  ]);
  if (!numerator.ok || !denominator.ok)
    return {
      ok: false,
      issues: [
        ...(!numerator.ok ? numerator.issues : []),
        ...(!denominator.ok ? denominator.issues : []),
      ],
    };
  if (denominator.value <= 0n)
    return invalid(['proposedAnswer', 'denominator'], 'chance.validation.denominator');
  if (
    numerator.value > answerLimit ||
    numerator.value < -answerLimit ||
    denominator.value > answerLimit
  )
    return invalid(['proposedAnswer'], 'chance.validation.answer-bound');
  if (numerator.value < 0n || numerator.value > denominator.value)
    return invalid(['proposedAnswer'], 'chance.validation.probability');
  return { ok: true, value: createRational(numerator.value, denominator.value) };
}

function validateSubmission(
  candidate: unknown,
): ValidationResult<ExperimentSubmission<ChanceInput, Rational>> {
  if (!isRecord(candidate)) return invalid([], 'chance.validation.shape');
  const input = parseChanceInput(candidate.input);
  const answer = parseProbabilityAnswer(candidate.proposedAnswer);
  if (!input.ok || !answer.ok)
    return {
      ok: false,
      issues: [...(!input.ok ? input.issues : []), ...(!answer.ok ? answer.issues : [])],
    };
  return { ok: true, value: { input: input.value, proposedAnswer: answer.value } };
}

export const chanceCrowDefinition: RobotDefinition<ChanceInput, Rational> = {
  id: 'chance-crow',
  nameKey: 'robot.chance-crow.name',
  descriptionKey: 'robot.chance-crow.description',
  domain: {
    id: 'without-replacement',
    validateSubmission,
    answersEqual: areRationalsEqual,
  },
  correctRule: ruleDefinitions.correct,
  misconceptionRules: [ruleDefinitions.independent, ruleDefinitions['second-only']],
};
export function sameChanceInput(left: ChanceInput, right: ChanceInput): boolean {
  return (
    left.red === right.red &&
    left.blue === right.blue &&
    left.first === right.first &&
    left.second === right.second
  );
}
export type VerificationScenario = 'different-positive' | 'same-positive' | 'zero';
export function verificationScenario(input: ChanceInput): VerificationScenario {
  const model = createProbabilityModel(input);
  return model.joint.numerator === 0n
    ? 'zero'
    : input.first === input.second
      ? 'same-positive'
      : 'different-positive';
}
const preferred: readonly ChanceInput[] = [
  { red: 2n, blue: 3n, first: 'red', second: 'blue' },
  { red: 4n, blue: 1n, first: 'red', second: 'red' },
  { red: 0n, blue: 3n, first: 'red', second: 'blue' },
];
function* verificationCandidates(seen: readonly ChanceInput[]): Iterable<ChanceInput> {
  const colors: readonly Color[] = ['red', 'blue'];
  for (const desired of preferred) {
    const scenario = verificationScenario(desired);
    if (!seen.some((input) => sameChanceInput(input, desired))) {
      yield desired;
      continue;
    }
    let selected = false;
    for (let red = 0n; red <= 10n && !selected; red += 1n) {
      for (let blue = 0n; blue <= 10n && !selected; blue += 1n) {
        if (red + blue < 2n || red + blue > 12n) continue;
        for (const first of colors) {
          for (const second of colors) {
            const input = { red, blue, first, second };
            if (
              verificationScenario(input) !== scenario ||
              seen.some((previous) => sameChanceInput(previous, input))
            )
              continue;
            yield input;
            selected = true;
            break;
          }
          if (selected) break;
        }
      }
    }
  }
}
const config: TeachingEngineConfig<ChanceInput, Rational, RuleId> = {
  name: 'ChanceCrow',
  rules: ruleDefinitions,
  correctId: 'correct',
  orderedRuleIds: ['independent', 'second-only', 'correct'],
  observationInput,
  parseInput: parseChanceInput,
  parseAnswer: parseProbabilityAnswer,
  validateSubmission,
  answersEqual: areRationalsEqual,
  sameInput: sameChanceInput,
  verificationCandidates: () => verificationCandidates([observationInput]),
  formatAnswer: formatProbability,
  validationMessages: messages,
  messages: {
    incorrectExample:
      '機率答案還不正確，候選規則沒有改變。先計算第一球，再按第一球移除後的袋子計算第二球，最後相乘。',
    incorrectVerification:
      '機率還不正確。不放回會改變球數；如果第一球目標不可能發生，整個序列的機率是零。',
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
  answerVerification,
} = engine;

/** Seeing a rejected answer's valid input must not turn it into an unseen verification question. */
export function teachExample(state: SessionState, submission: unknown): SessionResult {
  const result = engine.teachExample(state, submission);
  if (
    state.stage !== 'teach' ||
    result.feedback.code === 'inconsistent-state' ||
    result.feedback.code === 'inconsistent-evidence' ||
    !isRecord(submission)
  )
    return result;
  const input = parseChanceInput(submission.input);
  if (!input.ok) return result;
  const seen = [
    observationInput,
    ...state.experiments.map((item) => item.input),
    ...result.state.evidence.map((item) => item.input),
    ...(state.additionalSeenInputs ?? []),
  ];
  if (seen.some((previous) => sameChanceInput(previous, input.value))) return result;
  return {
    ...result,
    state: {
      ...result.state,
      additionalSeenInputs: [...(state.additionalSeenInputs ?? []), input.value],
    },
  };
}

export function beginVerification(state: SessionState): SessionResult {
  const seen = [
    observationInput,
    ...state.experiments.map((item) => item.input),
    ...state.evidence.map((item) => item.input),
    ...(state.additionalSeenInputs ?? []),
  ];
  return createTeachingEngine({
    ...config,
    verificationCandidates: () => verificationCandidates(seen),
  }).beginVerification(state);
}

import type {
  ExperimentSubmission,
  RobotDefinition,
  ValidationIssue,
  ValidationResult,
} from '../contracts';
import { areRationalsEqual, createRational } from '../math/rational';
import type { Rational } from '../math/rational';
import { formatFraction, ruleDefinitions } from './rules';
import type { AdditionInput, RuleId } from './rules';

export {
  evaluateRule,
  explainEvaluation,
  formatFraction,
  ruleDefinitions,
} from './rules';
export type { AdditionInput, RuleId } from './rules';

export interface RawFraction {
  readonly numerator: string;
  readonly denominator: string;
}

export interface DraftAddition {
  readonly left: RawFraction;
  readonly right: RawFraction;
}

import { createTeachingEngine } from '../teaching/engine';
import type {
  ExperimentRecord as SharedExperimentRecord,
  TeachingRecord as SharedTeachingRecord,
  RuleComparison as SharedRuleComparison,
  VerificationQuestion as SharedVerificationQuestion,
  VerificationAnswer as SharedVerificationAnswer,
  SessionState as SharedSessionState,
  SessionResult as SharedSessionResult,
} from '../teaching/engine';
export type { Feedback, Stage } from '../teaching/engine';
export type ExperimentRecord = SharedExperimentRecord<AdditionInput, Rational, RuleId>;
export type RuleComparison = SharedRuleComparison<Rational, RuleId>;
export type TeachingRecord = SharedTeachingRecord<AdditionInput, Rational, RuleId>;
export type VerificationQuestion = SharedVerificationQuestion<AdditionInput, Rational>;
export type VerificationAnswer = SharedVerificationAnswer<Rational>;
export type SessionState = SharedSessionState<AdditionInput, Rational, RuleId>;
export type SessionResult = SharedSessionResult<AdditionInput, Rational, RuleId>;

export const observationInput: AdditionInput = {
  left: { numerator: 1n, denominator: 2n },
  right: { numerator: 1n, denominator: 3n },
};

const operandLimit = 1000n;
const answerLimit = 1_000_000_000_000n;

const validationMessages: Readonly<Record<string, string>> = {
  'fraction.validation.shape': '請完整填寫兩個分數與答案。',
  'fraction.validation.integer': '分子與分母必須是整數，不能使用小數或科學記號。',
  'fraction.validation.zero-denominator': '分母不能為零。',
  'fraction.validation.positive-denominator': '本課程的分母必須是正整數。',
  'fraction.validation.operand-bound': '題目分子的絕對值與分母都不能超過 1000。',
  'fraction.validation.answer-bound':
    '答案分子的絕對值與分母都不能超過 1,000,000,000,000。',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: readonly (string | number)[], messageKey: string): ValidationIssue {
  return { code: messageKey.split('.').at(-1) ?? messageKey, path, messageKey };
}

function invalid<Value>(issues: readonly ValidationIssue[]): ValidationResult<Value> {
  return { ok: false, issues };
}

function parseInteger(
  candidate: unknown,
  path: readonly string[],
  limit: bigint,
  denominator: boolean,
): ValidationResult<bigint> {
  if (typeof candidate !== 'string') {
    return invalid([issue(path, 'fraction.validation.integer')]);
  }
  const text = candidate.trim();
  if (text.length > 32 || !/^[+-]?\d+$/.test(text)) {
    return invalid([issue(path, 'fraction.validation.integer')]);
  }
  const value = BigInt(text);
  if (denominator && value === 0n) {
    return invalid([issue(path, 'fraction.validation.zero-denominator')]);
  }
  if (denominator && value < 0n) {
    return invalid([issue(path, 'fraction.validation.positive-denominator')]);
  }
  if (value > limit || value < -limit) {
    return invalid([
      issue(
        path,
        limit === operandLimit
          ? 'fraction.validation.operand-bound'
          : 'fraction.validation.answer-bound',
      ),
    ]);
  }
  return { ok: true, value };
}

function parseFraction(
  candidate: unknown,
  path: readonly string[],
  limit: bigint,
): ValidationResult<Rational> {
  if (!isRecord(candidate)) {
    return invalid([issue(path, 'fraction.validation.shape')]);
  }
  const numerator = parseInteger(
    candidate.numerator,
    [...path, 'numerator'],
    limit,
    false,
  );
  const denominator = parseInteger(
    candidate.denominator,
    [...path, 'denominator'],
    limit,
    true,
  );
  if (!numerator.ok || !denominator.ok) {
    return invalid([
      ...(!numerator.ok ? numerator.issues : []),
      ...(!denominator.ok ? denominator.issues : []),
    ]);
  }
  return {
    ok: true,
    value: { numerator: numerator.value, denominator: denominator.value },
  };
}

export function parseAddition(candidate: unknown): ValidationResult<AdditionInput> {
  if (!isRecord(candidate)) {
    return invalid([issue(['input'], 'fraction.validation.shape')]);
  }
  const left = parseFraction(candidate.left, ['input', 'left'], operandLimit);
  const right = parseFraction(candidate.right, ['input', 'right'], operandLimit);
  if (!left.ok || !right.ok) {
    return invalid([
      ...(!left.ok ? left.issues : []),
      ...(!right.ok ? right.issues : []),
    ]);
  }
  return { ok: true, value: { left: left.value, right: right.value } };
}

export function parseAnswer(candidate: unknown): ValidationResult<Rational> {
  const answer = parseFraction(candidate, ['proposedAnswer'], answerLimit);
  return answer.ok
    ? {
        ok: true,
        value: createRational(answer.value.numerator, answer.value.denominator),
      }
    : answer;
}

function validateSubmission(
  candidate: unknown,
): ValidationResult<ExperimentSubmission<AdditionInput, Rational>> {
  if (!isRecord(candidate)) {
    return invalid([issue([], 'fraction.validation.shape')]);
  }
  const input = parseAddition(candidate.input);
  const answer = parseAnswer(candidate.proposedAnswer);
  if (!input.ok || !answer.ok) {
    return invalid([
      ...(!input.ok ? input.issues : []),
      ...(!answer.ok ? answer.issues : []),
    ]);
  }
  return { ok: true, value: { input: input.value, proposedAnswer: answer.value } };
}

export const fractionFoxDefinition: RobotDefinition<AdditionInput, Rational> = {
  id: 'fraction-fox',
  nameKey: 'robot.fraction-fox.name',
  descriptionKey: 'robot.fraction-fox.description',
  domain: {
    id: 'fraction-addition',
    validateSubmission,
    answersEqual: areRationalsEqual,
  },
  correctRule: ruleDefinitions.correct,
  misconceptionRules: [ruleDefinitions['add-both'], ruleDefinitions['keep-first']],
};

/** Pair identity is mathematical and unordered, independent of entered spellings. */
export function sameAddition(left: AdditionInput, right: AdditionInput): boolean {
  return (
    (areRationalsEqual(left.left, right.left) &&
      areRationalsEqual(left.right, right.right)) ||
    (areRationalsEqual(left.left, right.right) &&
      areRationalsEqual(left.right, right.left))
  );
}

/** Domain-owned deterministic pool; the shared engine removes all seen inputs. */
function* verificationCandidates(): Iterable<AdditionInput> {
  for (let leftDenominator = 2n; leftDenominator <= operandLimit; leftDenominator += 1n) {
    for (
      let rightDenominator = leftDenominator + 1n;
      rightDenominator <= operandLimit;
      rightDenominator += 1n
    ) {
      yield {
        left: { numerator: 1n, denominator: leftDenominator },
        right: { numerator: 1n, denominator: rightDenominator },
      };
    }
  }
}

const teachingEngine = createTeachingEngine<AdditionInput, Rational, RuleId>({
  name: 'FractionFox',
  rules: ruleDefinitions,
  correctId: 'correct',
  orderedRuleIds: ['add-both', 'keep-first', 'correct'],
  observationInput,
  parseInput: parseAddition,
  parseAnswer,
  validateSubmission,
  answersEqual: areRationalsEqual,
  sameInput: sameAddition,
  verificationCandidates,
  formatAnswer: formatFraction,
  validationMessages,
  messages: {
    incorrectExample:
      '這個示例的答案還不正確，沒有改變候選規則。請先通分、再把相同單位的分子相加。',
    incorrectVerification: '這題答案還不正確。先換成相同單位再相加，可以修改後重試。',
  },
});

export const {
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
} = teachingEngine;

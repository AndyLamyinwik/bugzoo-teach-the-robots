import type {
  ExperimentSubmission,
  RobotDefinition,
  ValidationIssue,
  ValidationResult,
} from '../contracts';
import { createTeachingEngine } from '../teaching/engine';
import type {
  ExperimentRecord as SharedExperimentRecord,
  RuleComparison as SharedRuleComparison,
  SessionResult as SharedSessionResult,
  SessionState as SharedSessionState,
  TeachingRecord as SharedTeachingRecord,
  VerificationAnswer as SharedVerificationAnswer,
  VerificationQuestion as SharedVerificationQuestion,
} from '../teaching/engine';
import { formatMoney, ruleDefinitions } from './rules';
import type { DiscountInput, RuleId } from './rules';

export {
  evaluateRule,
  explainEvaluation,
  formatExactMoney,
  formatMoney,
  formatPercent,
  getPriceStages,
  ruleDefinitions,
} from './rules';
export type { DiscountInput, PriceStage, RuleId } from './rules';
export type { Feedback, Stage } from '../teaching/engine';

export interface RawDiscountInput {
  readonly price: string;
  readonly firstDiscount: string;
  readonly secondDiscount: string;
}

export type SessionState = SharedSessionState<DiscountInput, bigint, RuleId>;
export type SessionResult = SharedSessionResult<DiscountInput, bigint, RuleId>;
export type ExperimentRecord = SharedExperimentRecord<DiscountInput, bigint, RuleId>;
export type TeachingRecord = SharedTeachingRecord<DiscountInput, bigint, RuleId>;
export type RuleComparison = SharedRuleComparison<bigint, RuleId>;
export type VerificationQuestion = SharedVerificationQuestion<DiscountInput, bigint>;
export type VerificationAnswer = SharedVerificationAnswer<bigint>;

export const observationInput: DiscountInput = {
  priceCents: 10_000n,
  firstDiscount: 2_000n,
  secondDiscount: 1_000n,
};

const maximumPriceCents = 100_000_000n;
const maximumDiscount = 10_000n;

const validationMessages: Readonly<Record<string, string>> = {
  'discount.validation.shape': '請完整填寫原價、兩次折扣與答案。',
  'discount.validation.money-format': '金額請使用整數或最多兩位小數，不能使用科學記號。',
  'discount.validation.percent-format':
    '折扣百分比請使用整數或最多兩位小數，不能使用科學記號。',
  'discount.validation.nonnegative': '原價、折扣與付款金額都不能為負數。',
  'discount.validation.money-bound': '金額必須介於 0 與 1,000,000.00 元。',
  'discount.validation.percent-bound': '每次折扣百分比必須介於 0% 與 100%。',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

/** Parse decimal text directly into hundredths, without passing through Number. */
function parseHundredths(
  candidate: unknown,
  path: readonly string[],
  percentage: boolean,
): ValidationResult<bigint> {
  const formatKey = percentage ? 'percent-format' : 'money-format';
  if (typeof candidate !== 'string') {
    return invalid(path, `discount.validation.${formatKey}`);
  }
  const text = candidate.trim();
  if (text.startsWith('-')) return invalid(path, 'discount.validation.nonnegative');
  const match = text.length <= 32 ? /^(\d+)(?:\.(\d{1,2}))?$/.exec(text) : null;
  const whole = match?.[1];
  if (whole === undefined) {
    return invalid(path, `discount.validation.${formatKey}`);
  }
  const decimals = match?.[2] ?? '';
  const value = BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'));
  const limit = percentage ? maximumDiscount : maximumPriceCents;
  if (value > limit) {
    return invalid(
      path,
      `discount.validation.${percentage ? 'percent-bound' : 'money-bound'}`,
    );
  }
  return { ok: true, value };
}

export function parseDiscountInput(candidate: unknown): ValidationResult<DiscountInput> {
  if (!isRecord(candidate)) return invalid(['input'], 'discount.validation.shape');
  const price = parseHundredths(candidate.price, ['input', 'price'], false);
  const first = parseHundredths(
    candidate.firstDiscount,
    ['input', 'firstDiscount'],
    true,
  );
  const second = parseHundredths(
    candidate.secondDiscount,
    ['input', 'secondDiscount'],
    true,
  );
  if (!price.ok || !first.ok || !second.ok) {
    const issues: readonly ValidationIssue[] = [
      ...(!price.ok ? price.issues : []),
      ...(!first.ok ? first.issues : []),
      ...(!second.ok ? second.issues : []),
    ];
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      priceCents: price.value,
      firstDiscount: first.value,
      secondDiscount: second.value,
    },
  };
}

export function parseMoneyAnswer(candidate: unknown): ValidationResult<bigint> {
  return parseHundredths(candidate, ['proposedAnswer'], false);
}

function validateSubmission(
  candidate: unknown,
): ValidationResult<ExperimentSubmission<DiscountInput, bigint>> {
  if (!isRecord(candidate)) return invalid([], 'discount.validation.shape');
  const input = parseDiscountInput(candidate.input);
  const answer = parseMoneyAnswer(candidate.proposedAnswer);
  if (!input.ok || !answer.ok) {
    return {
      ok: false,
      issues: [...(!input.ok ? input.issues : []), ...(!answer.ok ? answer.issues : [])],
    };
  }
  return { ok: true, value: { input: input.value, proposedAnswer: answer.value } };
}

export const discountPandaDefinition: RobotDefinition<DiscountInput, bigint> = {
  id: 'discount-panda',
  nameKey: 'robot.discount-panda.name',
  descriptionKey: 'robot.discount-panda.description',
  domain: {
    id: 'successive-discounts',
    validateSubmission,
    answersEqual: (left, right) => left === right,
  },
  correctRule: ruleDefinitions.correct,
  misconceptionRules: [ruleDefinitions['add-discounts'], ruleDefinitions['only-second']],
};

/** Conservatively exclude exchanged discounts too, despite only-second being order-sensitive. */
export function sameDiscountInput(left: DiscountInput, right: DiscountInput): boolean {
  return (
    left.priceCents === right.priceCents &&
    ((left.firstDiscount === right.firstDiscount &&
      left.secondDiscount === right.secondDiscount) ||
      (left.firstDiscount === right.secondDiscount &&
        left.secondDiscount === right.firstDiscount))
  );
}

function* verificationCandidates(): Iterable<DiscountInput> {
  yield { priceCents: 12_500n, firstDiscount: 1_500n, secondDiscount: 2_500n };
  yield { priceCents: 19_999n, firstDiscount: 3_333n, secondDiscount: 1_250n };
  yield { priceCents: 8_500n, firstDiscount: 4_000n, secondDiscount: 1_750n };
  const discounts = [
    { firstDiscount: 2_500n, secondDiscount: 1_000n },
    { firstDiscount: 1_250n, secondDiscount: 3_000n },
    { firstDiscount: 5_000n, secondDiscount: 2_500n },
    { firstDiscount: 7_500n, secondDiscount: 2_000n },
  ];
  // Lazy fallback remains deterministic and cannot be exhausted by a small teaching history.
  for (let priceCents = 1n; priceCents <= maximumPriceCents; priceCents += 1n) {
    for (const discount of discounts) yield { priceCents, ...discount };
  }
}

const engine = createTeachingEngine<DiscountInput, bigint, RuleId>({
  name: 'DiscountPanda',
  rules: ruleDefinitions,
  correctId: 'correct',
  orderedRuleIds: ['add-discounts', 'only-second', 'correct'],
  observationInput,
  parseInput: parseDiscountInput,
  parseAnswer: parseMoneyAnswer,
  validateSubmission,
  answersEqual: discountPandaDefinition.domain.answersEqual,
  sameInput: sameDiscountInput,
  verificationCandidates,
  formatAnswer: (answer) => `${formatMoney(answer)} 元`,
  validationMessages,
  messages: {
    incorrectExample:
      '這個付款金額還不正確，沒有改變候選規則。請分別套用兩次折扣，只在最後以 half-up 四捨五入到分。',
    incorrectVerification:
      '這題付款金額還不正確。第二次折扣以第一次折後價格為基準；保留精確中間值，最後再四捨五入到分。',
    lessonComplete:
      '你和 DiscountPanda 都通過三道未見題！在這組已知規則中，錯誤假設已被證據排除。',
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
} = engine;

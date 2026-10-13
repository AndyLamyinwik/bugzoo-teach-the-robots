/** UI-independent contracts for future, deterministic teaching experiments. */
export type ReasoningRuleKind = 'correct' | 'misconception';

/** Translation parameters are strings so exact numbers keep their precision. */
export interface ReasoningStep {
  readonly explanationKey: string;
  readonly parameters?: Readonly<Record<string, string>>;
}

export interface RuleEvaluation<Answer> {
  readonly answer: Answer;
  readonly steps: readonly ReasoningStep[];
}

/** Evaluators must be pure: the same valid input always yields the same result. */
export interface ReasoningRule<
  Input,
  Answer,
  Kind extends ReasoningRuleKind = ReasoningRuleKind,
> {
  readonly id: string;
  readonly kind: Kind;
  readonly descriptionKey: string;
  readonly evaluate: (input: Input) => RuleEvaluation<Answer>;
}

/** A proposed answer is student evidence, not yet an accepted correct example. */
export interface ExperimentSubmission<Input, Answer> {
  readonly input: Input;
  readonly proposedAnswer: Answer;
}

export interface ValidationIssue {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly messageKey: string;
}

export type ValidationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** Each subject owns parsing, supported input constraints, and answer equality. */
export interface ExperimentDomain<Input, Answer> {
  readonly id: string;
  readonly validateSubmission: (
    candidate: unknown,
  ) => ValidationResult<ExperimentSubmission<Input, Answer>>;
  readonly answersEqual: (left: Answer, right: Answer) => boolean;
}

export interface RobotDefinition<Input, Answer> {
  readonly id: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly domain: ExperimentDomain<Input, Answer>;
  readonly correctRule: ReasoningRule<Input, Answer, 'correct'>;
  readonly misconceptionRules: readonly ReasoningRule<Input, Answer, 'misconception'>[];
}

/** Includes the correct rule; accepted examples can only narrow this set. */
export interface HypothesisState {
  readonly remainingRuleIds: readonly string[];
}

/** Lesson content references a robot; it does not contain rule-engine state. */
export interface LessonDefinition {
  readonly id: string;
  readonly robotId: string;
  readonly titleKey: string;
  readonly learningGoalKeys: readonly string[];
}

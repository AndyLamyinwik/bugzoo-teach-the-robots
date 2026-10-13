import { describe, expect, it } from 'vitest';
import * as fraction from '../domain/fractionFox/engine';
import * as discount from '../domain/discountPanda/engine';
import * as minus from '../domain/minusMole/engine';
import * as chance from '../domain/chanceCrow/engine';
import type { Rational } from '../domain/math/rational';
import type { Stage, TeachingEngine } from '../domain/teaching/engine';
import { lessonCodecs, maximumHistory, maximumProgressBytes } from './codec';
import type { LessonId, LessonStateMap } from './types';

function rawFraction(value: Rational) {
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
  };
}
const fractionInput = {
  left: { numerator: '2', denominator: '4' },
  right: { numerator: '1', denominator: '3' },
};
const discountInput = {
  price: '199.99',
  firstDiscount: '33.33',
  secondDiscount: '12.50',
};
const minusInput = { a: '5', b: '-3' };
const chanceInput = { red: '3', blue: '2', first: 'red', second: 'blue' };

function stages<Input, Answer, Id extends string>(
  engine: TeachingEngine<Input, Answer, Id>,
  hypothesis: Id,
  experiment: unknown,
  evidence: readonly unknown[],
  rawAnswer: (answer: Answer) => unknown,
) {
  let state = engine.createSession();
  const states = [state];
  state = engine.beginHypothesis(state).state;
  states.push(state);
  state = engine.chooseHypothesis(state, hypothesis).state;
  states.push(state);
  state = engine.runExperiment(state, experiment).state;
  states.push(state);
  state = engine.beginTeaching(state).state;
  states.push(state);
  for (const item of evidence) {
    state = engine.teachExample(state, item).state;
    states.push(state);
  }
  state = engine.beginVerification(state).state;
  expect(state.stage).toBe('verify');
  states.push(state);
  for (const question of state.verification) {
    state = engine.answerVerification(
      state,
      question.id,
      rawAnswer(question.correctAnswer),
    ).state;
    states.push(state);
  }
  expect(state.stage).toBe('complete');
  return states;
}
interface Fixture {
  readonly id: LessonId;
  readonly rows: readonly {
    readonly stage: Stage;
    readonly state: unknown;
    readonly text: string;
  }[];
}
function fixture<Id extends LessonId>(
  id: Id,
  states: readonly LessonStateMap[Id][],
): Fixture {
  return {
    id,
    rows: states.map((state) => ({
      stage: state.stage,
      state,
      text: lessonCodecs[id].encode(state),
    })),
  };
}
export const fractionStates = () =>
  stages(
    fraction,
    'add-both',
    fractionInput,
    [{ input: fractionInput, proposedAnswer: { numerator: '5', denominator: '6' } }],
    rawFraction,
  );
export const discountStates = () =>
  stages(
    discount,
    'add-discounts',
    discountInput,
    [{ input: discountInput, proposedAnswer: '116.67' }],
    discount.formatMoney,
  );
export const minusStates = () =>
  stages(
    minus,
    'subtract-absolute',
    minusInput,
    [
      { input: minusInput, proposedAnswer: '8' },
      { input: { a: '-4', b: '3' }, proposedAnswer: '-7' },
    ],
    (answer) => answer.toString(),
  );
export const chanceStates = () =>
  stages(
    chance,
    'independent',
    chanceInput,
    [{ input: chanceInput, proposedAnswer: { numerator: '3', denominator: '10' } }],
    rawFraction,
  );
const fixtures = [
  fixture('fractionfox', fractionStates()),
  fixture('discountpanda', discountStates()),
  fixture('minusmole', minusStates()),
  fixture('chancecrow', chanceStates()),
];
function completeDto(id: LessonId): Record<string, unknown> {
  const row = fixtures.find((item) => item.id === id)?.rows.at(-1);
  if (!row) throw new Error('Missing fixture');
  return JSON.parse(row.text) as Record<string, unknown>;
}

describe('progress command replay for all four lessons', () => {
  it.each(fixtures)(
    'restores every legal stage and partial verification for $id',
    ({ id, rows }) => {
      for (const row of rows)
        expect(lessonCodecs[id].decode(row.text)).toEqual({ ok: true, state: row.state });
    },
  );
  it.each(fixtures)(
    'stores minimum accepted facts instead of derived rules for $id',
    ({ rows }) => {
      const dto: unknown = JSON.parse(rows.at(-1)?.text ?? 'null');
      if (typeof dto !== 'object' || dto === null) throw new Error('Expected DTO');
      for (const key of [
        'candidateRuleIds',
        'currentRuleId',
        'verification',
        'comparisons',
        'robotWasCorrect',
      ])
        expect(Object.hasOwn(dto, key)).toBe(false);
    },
  );
  it.each(fixtures)(
    'requires three exact ordered correct unseen answers before completion for $id',
    ({ id }) => {
      const dto = completeDto(id);
      const answers = dto.verificationAnswers;
      if (!Array.isArray(answers)) throw new Error('Missing answers');
      dto.verificationAnswers = answers.slice(0, 2);
      expect(lessonCodecs[id].decode(JSON.stringify(dto))).toEqual({
        ok: false,
        reason: 'corrupt',
      });
      dto.stage = 'verify';
      expect(lessonCodecs[id].decode(JSON.stringify(dto)).ok).toBe(true);
      dto.verificationAnswers = [...answers].reverse();
      expect(lessonCodecs[id].decode(JSON.stringify(dto)).ok).toBe(false);
    },
  );
  it.each(fixtures)(
    'rejects wrong evidence and missing experiment prerequisites for $id',
    ({ id }) => {
      const dto = completeDto(id);
      const evidence = dto.evidence;
      if (!Array.isArray(evidence)) throw new Error('Missing evidence');
      dto.evidence = evidence.map((item: unknown) => ({
        ...(item as Record<string, unknown>),
        proposedAnswer:
          id === 'fractionfox' || id === 'chancecrow'
            ? { numerator: '0', denominator: '1' }
            : '0',
      }));
      expect(lessonCodecs[id].decode(JSON.stringify(dto)).ok).toBe(false);
      dto.evidence = evidence;
      dto.experiments = [];
      expect(lessonCodecs[id].decode(JSON.stringify(dto)).ok).toBe(false);
    },
  );
  it('preserves unreduced fraction operands and recomputes their misconception evaluation', () => {
    const state = fractionStates()[3];
    if (!state) throw new Error('Missing experiment');
    const text = lessonCodecs.fractionfox.encode(state);
    expect(text).toContain('"numerator":"2","denominator":"4"');
    const result = lessonCodecs.fractionfox.decode(text);
    if (!result.ok) throw new Error('Expected restoration');
    expect(result.state.experiments[0]?.input.left).toEqual({
      numerator: 2n,
      denominator: 4n,
    });
    expect(result.state.experiments[0]?.robotEvaluation.answer).toEqual({
      numerator: 3n,
      denominator: 7n,
    });
  });
  it('round-trips exact cents, basis points and the final half-up answer', () => {
    const state = discountStates().at(-1);
    if (!state) throw new Error('Missing state');
    const result = lessonCodecs.discountpanda.decode(
      lessonCodecs.discountpanda.encode(state),
    );
    if (!result.ok) throw new Error('Expected restoration');
    expect(result.state.evidence[0]?.input).toEqual({
      priceCents: 19999n,
      firstDiscount: 3333n,
      secondDiscount: 1250n,
    });
    expect(result.state.evidence[0]?.proposedAnswer).toBe(11667n);
  });
  it('encodes negative integers as decimal strings and restores bigint values', () => {
    const dto = completeDto('minusmole');
    expect(JSON.stringify(dto)).toContain('"proposedAnswer":"-7"');
    const result = lessonCodecs.minusmole.decode(JSON.stringify(dto));
    if (!result.ok) throw new Error('Expected restoration');
    expect(result.state.evidence[1]?.proposedAnswer).toBe(-7n);
  });
  it('retains ChanceCrow rejected valid inputs for unseen selection without accepting them as evidence', () => {
    const state = chanceStates().find((item) => item.stage === 'teach');
    if (!state) throw new Error('Missing state');
    const seen = { red: '2', blue: '3', first: 'red', second: 'blue' };
    const rejected = chance.teachExample(state, {
      input: seen,
      proposedAnswer: { numerator: '0', denominator: '1' },
    }).state;
    const trained = chance.teachExample(rejected, {
      input: chanceInput,
      proposedAnswer: { numerator: '3', denominator: '10' },
    }).state;
    const verify = chance.beginVerification(trained).state;
    const result = lessonCodecs.chancecrow.decode(lessonCodecs.chancecrow.encode(verify));
    expect(result).toEqual({ ok: true, state: verify });
    if (!result.ok) throw new Error('Expected restoration');
    expect(result.state.evidence).toHaveLength(1);
    expect(result.state.additionalSeenInputs).toEqual([
      { red: 2n, blue: 3n, first: 'red', second: 'blue' },
    ]);
    const first = result.state.verification[0];
    expect(
      first !== undefined &&
        chance.sameChanceInput(first.input, {
          red: 2n,
          blue: 3n,
          first: 'red',
          second: 'blue',
        }),
    ).toBe(false);
  });
  it('retains a rejected ChanceCrow input even if it is subsequently taught correctly', () => {
    const state = chanceStates().find((item) => item.stage === 'teach');
    if (!state) throw new Error('Missing state');
    const seen = { red: '2', blue: '3', first: 'red', second: 'blue' };
    const rejected = chance.teachExample(state, {
      input: seen,
      proposedAnswer: null,
    }).state;
    const taught = chance.teachExample(rejected, {
      input: seen,
      proposedAnswer: { numerator: '3', denominator: '10' },
    }).state;
    expect(
      lessonCodecs.chancecrow.decode(lessonCodecs.chancecrow.encode(taught)),
    ).toEqual({ ok: true, state: taught });
  });
  it('keeps non-discriminating accepted evidence without declaring success', () => {
    const state = fractionStates().find((item) => item.stage === 'teach');
    if (!state) throw new Error('Missing state');
    const taught = fraction.teachExample(state, {
      input: {
        left: { numerator: '0', denominator: '2' },
        right: { numerator: '0', denominator: '3' },
      },
      proposedAnswer: { numerator: '0', denominator: '1' },
    }).state;
    const result = lessonCodecs.fractionfox.decode(
      lessonCodecs.fractionfox.encode(taught),
    );
    expect(result).toEqual({ ok: true, state: taught });
    expect(taught.candidateRuleIds).toHaveLength(3);
  });
});

describe('untrusted progress validation and version boundary', () => {
  it('classifies invalid version numbers as corrupt, reserving unsupported for positive integer versions', () => {
    for (const key of ['schemaVersion', 'lessonVersion']) {
      for (const invalid of [-1, 0, 1.5, 9_007_199_254_740_992, '1', null]) {
        const dto = completeDto('fractionfox');
        dto[key] = invalid;
        expect(lessonCodecs.fractionfox.decode(JSON.stringify(dto))).toEqual({
          ok: false,
          reason: 'corrupt',
        });
      }
      const text = JSON.stringify(completeDto('fractionfox')).replace(
        `"${key}":1`,
        `"${key}":1e309`,
      );
      expect(lessonCodecs.fractionfox.decode(text)).toEqual({
        ok: false,
        reason: 'corrupt',
      });
    }
  });
  it.each(fixtures)(
    'rejects incompatible versions without inventing migrations for $id',
    ({ id }) => {
      for (const key of ['schemaVersion', 'lessonVersion']) {
        const dto = completeDto(id);
        dto[key] = 2;
        expect(lessonCodecs[id].decode(JSON.stringify(dto))).toEqual({
          ok: false,
          reason: 'unsupported-version',
        });
      }
    },
  );
  it.each(['', '{', 'null', '[]', 'true', '{}', '"text"'])(
    'rejects malformed JSON/shape %j without throwing',
    (text) => {
      expect(lessonCodecs.fractionfox.decode(text)).toEqual({
        ok: false,
        reason: 'corrupt',
      });
    },
  );
  it('rejects extra derived fields and mismatched lesson keys', () => {
    const dto = completeDto('fractionfox');
    dto.currentRuleId = 'correct';
    expect(lessonCodecs.fractionfox.decode(JSON.stringify(dto)).ok).toBe(false);
    expect(
      lessonCodecs.minusmole.decode(JSON.stringify(completeDto('chancecrow'))).ok,
    ).toBe(false);
  });
  it('rejects nested unknown fields, out of range values, fake exact numbers and stage shortcuts', () => {
    const variants = [
      { experiments: [{ ...fractionInput, extra: true }] },
      {
        experiments: [
          { left: { numerator: '1', denominator: '0' }, right: fractionInput.right },
        ],
      },
      {
        experiments: [
          { left: { numerator: '1001', denominator: '4' }, right: fractionInput.right },
        ],
      },
      {
        experiments: [
          { left: { numerator: 2, denominator: '4' }, right: fractionInput.right },
        ],
      },
      {
        experiments: [
          { left: { numerator: '2e0', denominator: '4' }, right: fractionInput.right },
        ],
      },
      { hypothesis: null },
      { stage: 'unknown' },
      { stage: 'observe' },
      {
        evidence: [
          {
            input: fractionInput,
            proposedAnswer: { numerator: '5', denominator: '6', extra: 1 },
          },
        ],
      },
      {
        evidence: [
          {
            input: fractionInput,
            proposedAnswer: { numerator: '5', denominator: '6' },
            eliminatedRuleIds: ['add-both'],
          },
        ],
      },
    ];
    for (const change of variants)
      expect(
        lessonCodecs.fractionfox.decode(
          JSON.stringify({ ...completeDto('fractionfox'), ...change }),
        ).ok,
      ).toBe(false);
  });
  it('rejects fake ChanceCrow colors, impossible bags and duplicate additional history', () => {
    for (const input of [
      { ...chanceInput, first: 'green' },
      { ...chanceInput, red: '11' },
      { ...chanceInput, red: '0', blue: '1' },
      { ...chanceInput, red: '10', blue: '10' },
    ])
      expect(
        lessonCodecs.chancecrow.decode(
          JSON.stringify({ ...completeDto('chancecrow'), experiments: [input] }),
        ).ok,
      ).toBe(false);
    const input = { red: '2', blue: '3', first: 'red', second: 'blue' };
    expect(
      lessonCodecs.chancecrow.decode(
        JSON.stringify({
          ...completeDto('chancecrow'),
          additionalSeenInputs: [input, input],
        }),
      ).ok,
    ).toBe(false);
  });
  it('bounds JSON size, string lengths and history before replay', () => {
    expect(lessonCodecs.fractionfox.decode(' '.repeat(maximumProgressBytes + 1)).ok).toBe(
      false,
    );
    const dto = completeDto('fractionfox');
    dto.experiments = Array.from({ length: maximumHistory + 1 }, () => fractionInput);
    expect(lessonCodecs.fractionfox.decode(JSON.stringify(dto)).ok).toBe(false);
    dto.experiments = [
      {
        left: { numerator: '9'.repeat(1000), denominator: '1' },
        right: fractionInput.right,
      },
    ];
    expect(lessonCodecs.fractionfox.decode(JSON.stringify(dto)).ok).toBe(false);
  });
});

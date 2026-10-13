import { describe, expect, it } from 'vitest';

import { createRational } from '../math/rational';
import {
  colorProbability,
  countColors,
  createBalls,
  createProbabilityModel,
  enumerateSampleSpace,
} from './probability';
import type { ChanceInput, Color } from './probability';
import { evaluateRule, explainEvaluation } from './rules';

const observed: ChanceInput = { red: 3n, blue: 2n, first: 'red', second: 'blue' };

describe('ChanceCrow conditional probability model', () => {
  it('changes the second denominator after the target first ball is removed', () => {
    const model = createProbabilityModel(observed);
    expect(model.firstProbability).toEqual(createRational(3n, 5n));
    expect(model.conditionalSecond).toEqual(createRational(2n, 4n));
    expect(model.remainingCounts).toEqual({ red: 2n, blue: 2n });
    expect(model.joint).toEqual(createRational(3n, 10n));
  });

  it('removes one target-color ball when both target colors are the same', () => {
    const model = createProbabilityModel({ ...observed, second: 'red' });
    expect(model.conditionalSecond).toEqual(createRational(2n, 4n));
    expect(model.joint).toEqual(createRational(3n, 10n));
    const scarce = createProbabilityModel({
      red: 1n,
      blue: 1n,
      first: 'red',
      second: 'red',
    });
    expect(scarce.firstProbability).toEqual(createRational(1n, 2n));
    expect(scarce.conditionalSecond).toEqual(createRational(0n, 1n));
    expect(scarce.joint).toEqual(createRational(0n, 1n));
  });

  it('represents conditioning on an impossible first target as null, never an ordinary multiplier', () => {
    const input: ChanceInput = { red: 0n, blue: 3n, first: 'red', second: 'blue' };
    const model = createProbabilityModel(input);
    expect(model.firstProbability).toEqual(createRational(0n, 1n));
    expect(model.conditionalSecond).toBe(null);
    expect(model.remainingCounts).toBe(null);
    expect(model.joint).toEqual(createRational(0n, 1n));
    const result = evaluateRule('correct', input);
    expect(result.steps.map((step) => step.explanationKey)).toEqual([
      'chance.first',
      'chance.impossible-first',
    ]);
    expect(explainEvaluation(result).join(' ')).toContain('條件機率不存在');
    expect(explainEvaluation(result).join(' ').includes('undefined')).toBe(false);
  });

  it('distinguishes the three rule predictions and is deterministic', () => {
    expect(evaluateRule('correct', observed).answer).toEqual(createRational(3n, 10n));
    expect(evaluateRule('independent', observed).answer).toEqual(createRational(6n, 25n));
    expect(evaluateRule('second-only', observed).answer).toEqual(createRational(2n, 5n));
    const before = structuredClone(observed);
    expect(evaluateRule('correct', observed)).toEqual(evaluateRule('correct', observed));
    expect(observed).toEqual(before);
  });

  it('keeps physical IDs distinct and enumerates all ordered pairs without diagonal draws', () => {
    const balls = createBalls(observed);
    expect(balls.map((ball) => ball.id)).toEqual(['R1', 'R2', 'R3', 'B1', 'B2']);
    const outcomes = enumerateSampleSpace(observed);
    expect(outcomes).toHaveLength(20);
    expect(new Set(outcomes.map((outcome) => outcome.id)).size).toBe(20);
    expect(outcomes.every((outcome) => outcome.first.id !== outcome.second.id)).toBe(
      true,
    );
    expect(outcomes.filter((outcome) => outcome.matchesTarget)).toHaveLength(6);
    expect(outcomes.some((outcome) => outcome.id === 'R1>R2')).toBe(true);
    expect(outcomes.some((outcome) => outcome.id === 'R2>R1')).toBe(true);
  });

  it('counts actual remaining balls and provides no next probability for an empty bag', () => {
    const balls = createBalls(observed).filter((ball) => ball.id !== 'R1');
    expect(countColors(balls)).toEqual({ red: 2n, blue: 2n });
    expect(colorProbability(balls, 'blue')).toEqual(createRational(1n, 2n));
    expect(colorProbability([], 'red')).toBe(null);
  });

  it('matches a physical ordered-pair oracle and exact misconception formulas for every legal bag and target', () => {
    const colors: readonly Color[] = ['red', 'blue'];
    for (let red = 0n; red <= 10n; red += 1n) {
      for (let blue = 0n; blue <= 10n; blue += 1n) {
        const total = red + blue;
        if (total < 2n || total > 12n) continue;
        for (const first of colors) {
          for (const second of colors) {
            const input: ChanceInput = { red, blue, first, second };
            const model = createProbabilityModel(input);
            const sampleSpace = enumerateSampleSpace(input);
            const hits = BigInt(
              sampleSpace.filter((outcome) => outcome.matchesTarget).length,
            );
            expect(sampleSpace).toHaveLength(Number(total * (total - 1n)));
            expect(model.joint).toEqual(createRational(hits, total * (total - 1n)));
            const firstCount = input[first];
            const secondCount = input[second];
            expect(evaluateRule('independent', input).answer).toEqual(
              createRational(firstCount * secondCount, total * total),
            );
            expect(evaluateRule('second-only', input).answer).toEqual(
              createRational(secondCount, total),
            );
            expect(
              model.joint.numerator >= 0n &&
                model.joint.numerator <= model.joint.denominator,
            ).toBe(true);
            expect(model.conditionalSecond === null).toBe(firstCount === 0n);
            if (model.remainingCounts !== null) {
              expect(model.remainingCounts.red + model.remainingCounts.blue).toBe(
                total - 1n,
              );
              expect(
                model.remainingCounts.red >= 0n && model.remainingCounts.blue >= 0n,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it('rejects out-of-domain bags before constructing sample spaces', () => {
    expect(() => createProbabilityModel({ ...observed, red: -1n })).toThrow(RangeError);
    expect(() => createBalls({ ...observed, red: 11n })).toThrow(RangeError);
    expect(() => enumerateSampleSpace({ ...observed, red: 0n, blue: 1n })).toThrow(
      RangeError,
    );
    expect(() => createProbabilityModel({ ...observed, red: 10n, blue: 10n })).toThrow(
      RangeError,
    );
  });
});

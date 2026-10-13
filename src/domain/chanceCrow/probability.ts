import { createRational } from '../math/rational';
import type { Rational } from '../math/rational';

export type Color = 'red' | 'blue';

export interface ChanceInput {
  readonly red: bigint;
  readonly blue: bigint;
  readonly first: Color;
  readonly second: Color;
}

export interface ColorCounts {
  readonly red: bigint;
  readonly blue: bigint;
}

export interface Ball {
  readonly id: string;
  readonly color: Color;
}

export interface OrderedOutcome {
  readonly id: string;
  readonly first: Ball;
  readonly second: Ball;
  readonly matchesTarget: boolean;
}

export interface ProbabilityModel {
  readonly total: bigint;
  readonly firstCount: bigint;
  readonly secondCountBefore: bigint;
  readonly firstProbability: Rational;
  readonly conditionalSecond: Rational | null;
  readonly joint: Rational;
  readonly remainingCounts: ColorCounts | null;
}

export function isColor(candidate: unknown): candidate is Color {
  return candidate === 'red' || candidate === 'blue';
}

export function colorLabel(color: Color): string {
  return color === 'red' ? '紅球' : '藍球';
}

/** Validated integer bounds keep physical bags small and prohibit undefined denominators. */
export function assertChanceInput(input: ChanceInput): void {
  const total = input.red + input.blue;
  if (
    input.red < 0n ||
    input.red > 10n ||
    input.blue < 0n ||
    input.blue > 10n ||
    total < 2n ||
    total > 12n ||
    !isColor(input.first) ||
    !isColor(input.second)
  ) {
    throw new RangeError('Each ball count must be 0..10 and the total must be 2..12.');
  }
}

export function createProbabilityModel(input: ChanceInput): ProbabilityModel {
  assertChanceInput(input);
  const total = input.red + input.blue;
  const firstCount = input[input.first];
  const secondCountBefore = input[input.second];
  const firstProbability = createRational(firstCount, total);
  if (firstCount === 0n) {
    return {
      total,
      firstCount,
      secondCountBefore,
      firstProbability,
      conditionalSecond: null,
      joint: createRational(0n, 1n),
      remainingCounts: null,
    };
  }
  const remainingCounts = {
    red: input.red - (input.first === 'red' ? 1n : 0n),
    blue: input.blue - (input.first === 'blue' ? 1n : 0n),
  };
  const conditionalSecond = createRational(remainingCounts[input.second], total - 1n);
  const joint = createRational(
    firstProbability.numerator * conditionalSecond.numerator,
    firstProbability.denominator * conditionalSecond.denominator,
  );
  return {
    total,
    firstCount,
    secondCountBefore,
    firstProbability,
    conditionalSecond,
    joint,
    remainingCounts,
  };
}

export function createBalls(input: ChanceInput): readonly Ball[] {
  assertChanceInput(input);
  const balls: Ball[] = [];
  for (let index = 1n; index <= input.red; index += 1n)
    balls.push({ id: `R${index}`, color: 'red' });
  for (let index = 1n; index <= input.blue; index += 1n)
    balls.push({ id: `B${index}`, color: 'blue' });
  return balls;
}

export function countColors(balls: readonly Ball[]): ColorCounts {
  let red = 0n;
  let blue = 0n;
  for (const ball of balls) {
    if (ball.color === 'red') red += 1n;
    else blue += 1n;
  }
  return { red, blue };
}

/** Probability in the actual physical remainder; an empty bag has no next draw. */
export function colorProbability(balls: readonly Ball[], color: Color): Rational | null {
  return balls.length === 0
    ? null
    : createRational(countColors(balls)[color], BigInt(balls.length));
}

/** Equal-color balls remain distinguishable; each physical ordered pair is equally likely. */
export function enumerateSampleSpace(input: ChanceInput): readonly OrderedOutcome[] {
  const balls = createBalls(input);
  const outcomes: OrderedOutcome[] = [];
  for (const first of balls) {
    for (const second of balls) {
      if (first.id === second.id) continue;
      outcomes.push({
        id: `${first.id}>${second.id}`,
        first,
        second,
        matchesTarget: first.color === input.first && second.color === input.second,
      });
    }
  }
  return outcomes;
}

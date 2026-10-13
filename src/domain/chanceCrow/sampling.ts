import { createRational } from '../math/rational';
import type { Rational } from '../math/rational';
import { createBalls } from './probability';
import type { Ball, ChanceInput } from './probability';

export type Rng = () => number;

export interface DrawState {
  readonly input: ChanceInput;
  readonly remaining: readonly Ball[];
  readonly drawn: readonly Ball[];
  readonly matchesTarget: boolean | null;
}

export interface Trial {
  readonly first: Ball;
  readonly second: Ball;
  readonly matchesTarget: boolean;
}

export interface SimulationResult {
  readonly trials: number;
  readonly hits: number;
  readonly frequency: Rational;
  readonly lastTrial: Trial;
}

export function createDrawState(input: ChanceInput): DrawState {
  return {
    input: { ...input },
    remaining: createBalls(input),
    drawn: [],
    matchesTarget: null,
  };
}

export function resetDrawState(state: DrawState): DrawState {
  return createDrawState(state.input);
}

/** Physical randomness is injected; it never participates in reasoning or teaching guards. */
export function drawBall(state: DrawState, rng: Rng): DrawState {
  if (state.drawn.length >= 2) return state;
  if (state.remaining.length === 0)
    throw new RangeError('A physical draw requires a remaining ball.');
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new RangeError('RNG must return a finite number in [0, 1).');
  const index = Math.floor(value * state.remaining.length);
  const ball = state.remaining[index];
  if (ball === undefined)
    throw new RangeError('The draw index must point to a remaining ball.');
  const drawn = [...state.drawn, ball];
  const first = drawn[0];
  const second = drawn[1];
  const matchesTarget =
    first !== undefined && second !== undefined
      ? first.color === state.input.first && second.color === state.input.second
      : null;
  return {
    input: state.input,
    drawn,
    remaining: state.remaining.filter((_, position) => position !== index),
    matchesTarget,
  };
}

export function sampleTrial(input: ChanceInput, rng: Rng): Trial {
  const completed = drawBall(drawBall(createDrawState(input), rng), rng);
  const first = completed.drawn[0];
  const second = completed.drawn[1];
  if (first === undefined || second === undefined || completed.matchesTarget === null)
    throw new RangeError('A trial must contain two physical draws.');
  return { first, second, matchesTarget: completed.matchesTarget };
}

/** Zero trials have no empirical frequency, rather than an observed zero probability. */
export function empiricalFrequency(trials: number, hits: number): Rational | null {
  if (
    !Number.isSafeInteger(trials) ||
    !Number.isSafeInteger(hits) ||
    trials < 0 ||
    hits < 0 ||
    hits > trials
  )
    throw new RangeError(
      'Frequency counts must be nonnegative safe integers with hits <= trials.',
    );
  return trials === 0 ? null : createRational(BigInt(hits), BigInt(trials));
}

export function simulateTrials(
  input: ChanceInput,
  count: number,
  rng: Rng,
): SimulationResult {
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000)
    throw new RangeError('A simulation batch must contain 1..1000 trials.');
  let hits = 0;
  let lastTrial: Trial | undefined;
  for (let index = 0; index < count; index += 1) {
    const trial = sampleTrial(input, rng);
    if (trial.matchesTarget) hits += 1;
    lastTrial = trial;
  }
  if (lastTrial === undefined)
    throw new RangeError('A simulation needs at least one trial.');
  return {
    trials: count,
    hits,
    frequency: createRational(BigInt(hits), BigInt(count)),
    lastTrial,
  };
}

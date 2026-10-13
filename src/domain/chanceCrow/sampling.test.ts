import { describe, expect, it } from 'vitest';

import { createRational } from '../math/rational';
import { colorProbability } from './probability';
import type { ChanceInput } from './probability';
import {
  createDrawState,
  drawBall,
  empiricalFrequency,
  resetDrawState,
  sampleTrial,
  simulateTrials,
} from './sampling';

const input: ChanceInput = { red: 3n, blue: 2n, first: 'red', second: 'blue' };

describe('ChanceCrow physical drawing', () => {
  it('removes the actual drawn ID and computes target success only after two balls', () => {
    const initial = createDrawState(input);
    const before = structuredClone(initial);
    const first = drawBall(initial, () => 0);
    expect(first.drawn[0]).toEqual({ id: 'R1', color: 'red' });
    expect(first.remaining.map((ball) => ball.id)).toEqual(['R2', 'R3', 'B1', 'B2']);
    expect(first.matchesTarget).toBe(null);
    expect(colorProbability(first.remaining, 'blue')).toEqual(createRational(1n, 2n));
    const second = drawBall(first, () => 0.999999);
    expect(second.drawn[1]).toEqual({ id: 'B2', color: 'blue' });
    expect(second.matchesTarget).toBe(true);
    expect(second.remaining).toHaveLength(3);
    expect(initial).toEqual(before);
    expect(
      drawBall(second, () => {
        throw new Error('No third draw is allowed.');
      }),
    ).toBe(second);
  });

  it('does not redraw the same physical ball even when both draws have the same color', () => {
    const trial = sampleTrial({ ...input, second: 'red' }, () => 0);
    expect(trial.first.id).toBe('R1');
    expect(trial.second.id).toBe('R2');
    expect(trial.matchesTarget).toBe(true);
    expect(trial.first.id === trial.second.id).toBe(false);
  });

  it('draws real balls even when the target first event is impossible', () => {
    const impossible: ChanceInput = { red: 0n, blue: 2n, first: 'red', second: 'blue' };
    const first = drawBall(createDrawState(impossible), () => 0);
    expect(first.drawn[0]?.color).toBe('blue');
    const second = drawBall(first, () => 0);
    expect(second.drawn.map((ball) => ball.id)).toEqual(['B1', 'B2']);
    expect(second.remaining).toEqual([]);
    expect(second.matchesTarget).toBe(false);
    expect(colorProbability(second.remaining, 'blue')).toBe(null);
  });

  it.each([-0.01, 1, 2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid injected RNG output %s without changing the bag',
    (value) => {
      const state = createDrawState(input);
      const before = structuredClone(state);
      expect(() => drawBall(state, () => value)).toThrow(RangeError);
      expect(state).toEqual(before);
    },
  );

  it('validates the RNG on the second draw as well', () => {
    const first = drawBall(createDrawState(input), () => 0);
    expect(() => drawBall(first, () => 1)).toThrow(RangeError);
    expect(first.remaining).toHaveLength(4);
  });

  it('restores the full bag between manual trials', () => {
    const completed = drawBall(
      drawBall(createDrawState(input), () => 0),
      () => 0,
    );
    const reset = resetDrawState(completed);
    expect(reset.remaining.map((ball) => ball.id)).toEqual([
      'R1',
      'R2',
      'R3',
      'B1',
      'B2',
    ]);
    expect(reset.drawn).toEqual([]);
    expect(reset.matchesTarget).toBe(null);
    expect(completed.drawn).toHaveLength(2);
  });
});

describe('ChanceCrow repeatable simulation counts', () => {
  it.each([50, 100])(
    'runs %s fresh trials with two draws each and no reasoning-rule dependency',
    (count) => {
      let calls = 0;
      const simulation = simulateTrials(input, count, () => {
        calls += 1;
        return calls % 2 === 1 ? 0 : 0.999999;
      });
      expect(calls).toBe(count * 2);
      expect(simulation.trials).toBe(count);
      expect(simulation.hits).toBe(count);
      expect(simulation.frequency).toEqual(createRational(1n, 1n));
      expect(simulation.lastTrial).toMatchObject({
        first: { id: 'R1' },
        second: { id: 'B2' },
        matchesTarget: true,
      });
      // This deterministic testing frequency is deliberately different from the exact theoretical 3/10.
    },
  );

  it('tracks misses from physical draws rather than treating target colors as guaranteed', () => {
    const simulation = simulateTrials(input, 50, () => 0);
    expect(simulation.hits).toBe(0);
    expect(simulation.frequency).toEqual(createRational(0n, 1n));
    expect(simulation.lastTrial).toMatchObject({
      first: { color: 'red' },
      second: { color: 'red' },
      matchesTarget: false,
    });
  });

  it.each([0, -1, 1.5, 1001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid batch size %s',
    (count) => {
      expect(() => simulateTrials(input, count, () => 0)).toThrow(RangeError);
    },
  );

  it('uses exact count ratios and distinguishes no observations from zero hits', () => {
    expect(empiricalFrequency(0, 0)).toBe(null);
    expect(empiricalFrequency(100, 30)).toEqual(createRational(3n, 10n));
    expect(empiricalFrequency(100, 0)).toEqual(createRational(0n, 1n));
    expect(() => empiricalFrequency(2, 3)).toThrow(RangeError);
    expect(() => empiricalFrequency(-1, 0)).toThrow(RangeError);
    expect(() => empiricalFrequency(10, 0.5)).toThrow(RangeError);
    expect(() => empiricalFrequency(Number.MAX_SAFE_INTEGER + 1, 0)).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';

import { createNumberLineModel } from './numberLine';
import { evaluateRule } from './rules';
import type { RuleId, SubtractionInput } from './rules';

describe('MinusMole exact number-line model', () => {
  it('moves right when subtracting a negative and left when subtracting a positive', () => {
    const right = createNumberLineModel({ a: 5n, b: -3n }, 'correct');
    expect(right.start).toBe(5n);
    expect(right.end).toBe(8n);
    expect(right.segments).toMatchObject([
      {
        from: 5n,
        to: 8n,
        kind: 'subtract',
        direction: 'right',
        distance: 3n,
        isMisconception: false,
      },
    ]);
    const left = createNumberLineModel({ a: -4n, b: 3n }, 'correct');
    expect(left.end).toBe(-7n);
    expect(left.segments[0]?.direction).toBe('left');
    expect(left.segments[0]?.distance).toBe(3n);
  });

  it('shows the absolute-subtrahend misconception as a wrong leftward move', () => {
    const model = createNumberLineModel({ a: 5n, b: -3n }, 'subtract-absolute');
    expect(model.segments).toMatchObject([
      {
        from: 5n,
        to: 2n,
        kind: 'subtract',
        direction: 'left',
        distance: 3n,
        isMisconception: true,
      },
    ]);
    expect(model.segments[0]?.label).toContain('取絕對值 3');
    expect(model.end).toBe(evaluateRule('subtract-absolute', { a: 5n, b: -3n }).answer);
  });

  it('shows a negative answer followed by a distinct erroneous reflection, not a second subtraction', () => {
    const input = { a: -4n, b: 3n };
    const model = createNumberLineModel(input, 'absolute-result');
    expect(model.start).toBe(-4n);
    expect(model.end).toBe(7n);
    expect(model.segments).toMatchObject([
      {
        from: -4n,
        to: -7n,
        kind: 'subtract',
        direction: 'left',
        distance: 3n,
        isMisconception: false,
      },
      {
        from: -7n,
        to: 7n,
        kind: 'reflect',
        direction: 'right',
        distance: 14n,
        isMisconception: true,
      },
    ]);
    expect(model.segments[1]?.label).toContain('鏡射不是減法步驟');
    expect(model.end).toBe(evaluateRule('absolute-result', input).answer);
  });

  it('retains a stationary zero move and avoids fabricating reflections for nonnegative answers', () => {
    const zero = createNumberLineModel({ a: 0n, b: 0n }, 'correct');
    expect(zero.segments).toMatchObject([
      { from: 0n, to: 0n, direction: 'none', distance: 0n },
    ]);
    expect(zero.segments[0]?.label).toContain('不移動');
    expect(
      createNumberLineModel({ a: 5n, b: -3n }, 'absolute-result').segments,
    ).toHaveLength(1);
    expect(
      createNumberLineModel({ a: -3n, b: -3n }, 'absolute-result').segments,
    ).toHaveLength(1);
  });

  it('contains every bounded path point and zero with ordered, evenly spaced ticks', () => {
    const ids: readonly RuleId[] = ['correct', 'subtract-absolute', 'absolute-result'];
    for (let a = -20n; a <= 20n; a += 1n) {
      for (let b = -20n; b <= 20n; b += 1n) {
        const input: SubtractionInput = { a, b };
        for (const id of ids) {
          const model = createNumberLineModel(input, id);
          expect(model.min < model.max).toBe(true);
          expect(model.min < 0n && model.max > 0n).toBe(true);
          expect(model.ticks.includes(0n)).toBe(true);
          expect(model.ticks.length <= 9).toBe(true);
          expect(model.ticks[0]).toBe(model.min);
          expect(model.ticks.at(-1)).toBe(model.max);
          const first = model.ticks[0];
          const second = model.ticks[1];
          if (first === undefined || second === undefined)
            throw new Error('A number line needs at least two ticks.');
          const step = second - first;
          for (let index = 1; index < model.ticks.length; index += 1) {
            expect(model.ticks[index]).toBe(first + BigInt(index) * step);
          }
          for (const segment of model.segments) {
            expect(segment.from > model.min && segment.from < model.max).toBe(true);
            expect(segment.to > model.min && segment.to < model.max).toBe(true);
            expect(segment.distance >= 0n).toBe(true);
          }
          expect(model.end).toBe(evaluateRule(id, input).answer);
        }
      }
    }
  });

  it('rejects out-of-domain operands rather than rendering an unbounded line', () => {
    expect(() => createNumberLineModel({ a: 21n, b: 0n }, 'correct')).toThrow(RangeError);
    expect(() => createNumberLineModel({ a: 0n, b: -21n }, 'correct')).toThrow(
      RangeError,
    );
  });
});

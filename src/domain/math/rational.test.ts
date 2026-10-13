import { describe, expect, it } from 'vitest';

import { areRationalsEqual, createRational } from './rational';

describe('createRational', () => {
  it('reduces fractions to coprime terms', () => {
    expect(createRational(18n, 24n)).toEqual({ numerator: 3n, denominator: 4n });
  });

  it('moves the sign to the numerator', () => {
    expect(createRational(18n, -24n)).toEqual({ numerator: -3n, denominator: 4n });
    expect(createRational(-18n, 24n)).toEqual({ numerator: -3n, denominator: 4n });
    expect(createRational(-18n, -24n)).toEqual({ numerator: 3n, denominator: 4n });
  });

  it('represents zero canonically even with a negative denominator', () => {
    expect(createRational(0n, -24n)).toEqual({ numerator: 0n, denominator: 1n });
  });

  it('rejects a zero denominator', () => {
    expect(() => createRational(1n, 0n)).toThrow(RangeError);
    expect(() => createRational(0n, 0n)).toThrow(RangeError);
  });
});

describe('areRationalsEqual', () => {
  it('compares equivalent fractions, including non-normalized values', () => {
    expect(
      areRationalsEqual({ numerator: 2n, denominator: 6n }, createRational(1n, 3n)),
    ).toBe(true);
    expect(areRationalsEqual(createRational(-1n, 3n), createRational(1n, 3n))).toBe(
      false,
    );
  });

  it('preserves equality and inequality beyond the safe Number integer range', () => {
    const largeInteger = 9_007_199_254_740_993n;

    expect(
      areRationalsEqual(
        createRational(largeInteger * 2n, 6n),
        createRational(largeInteger, 3n),
      ),
    ).toBe(true);
    expect(
      areRationalsEqual(
        createRational(largeInteger, 3n),
        createRational(largeInteger - 1n, 3n),
      ),
    ).toBe(false);
  });

  it('rejects invalid rational values at comparison boundaries', () => {
    const invalid = { numerator: 1n, denominator: 0n };
    const valid = createRational(1n, 2n);

    expect(() => areRationalsEqual(invalid, valid)).toThrow(RangeError);
    expect(() => areRationalsEqual(valid, invalid)).toThrow(RangeError);
  });
});

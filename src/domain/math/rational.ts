/** Canonical exact fraction: coprime terms and a strictly positive denominator. */
export interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let dividend = left;
  let divisor = right;

  while (divisor !== 0n) {
    const remainder = dividend % divisor;
    dividend = divisor;
    divisor = remainder;
  }

  return dividend;
}

/** Use bigint literals or integer strings; avoid first converting through Number. */
export function createRational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) {
    throw new RangeError('A rational number must have a nonzero denominator.');
  }

  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const divisor = greatestCommonDivisor(absoluteNumerator, absoluteDenominator);
  const sign = denominator < 0n ? -1n : 1n;

  return {
    numerator: (numerator / divisor) * sign,
    denominator: absoluteDenominator / divisor,
  };
}

/** Cross multiplication also supports valid, non-normalized rational values. */
export function areRationalsEqual(left: Rational, right: Rational): boolean {
  if (left.denominator === 0n || right.denominator === 0n) {
    throw new RangeError('A rational number must have a nonzero denominator.');
  }

  return left.numerator * right.denominator === right.numerator * left.denominator;
}
